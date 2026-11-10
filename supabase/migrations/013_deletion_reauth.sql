-- 013: account deletion needs a fresh sign-in
--
-- Replaces public.delete_my_account() from 010. It now refuses unless the
-- caller signed in (password, Google or Apple) within the last 10 minutes.
-- The Settings dialog asks for the password again, or sends Google and
-- Apple users through their provider once more, right before deleting. A
-- session left open on a shared or stolen device can no longer delete the
-- account on its own.
--
-- Freshness signal: the newest timestamp in the access token's `amr` claim.
-- Supabase Auth records one entry per way the session was proven
-- (password, oauth, otp, ...), stamped when that sign-in happened, and keeps
-- it unchanged when the token is refreshed. It belongs to this session only,
-- so signing in on another device doesn't make this one fresh.
-- Not used:
--   * the token's `iat`, which is reset on every hourly token refresh, so an
--     old session would look fresh;
--   * auth.users.last_sign_in_at as the main signal, because it is per user:
--     a sign-in anywhere would make every open session look fresh. It is only
--     the fallback when a token carries no usable `amr` at all.
--
-- Error: SQLSTATE 28000 (invalid_authorization_specification), message
-- "Confirm it's you again", hint 'reauth_required'. The app shows the
-- confirm step again on it.
--
-- Order in the app (also changed with this migration): the account is
-- deleted first, then the photos in listing-photos/<user id>/. Storage dropped
-- its foreign key from storage.objects to auth.users (storage migrations
-- 0017 and 0018), so deleting the sign-in leaves the files in place, and the
-- still-valid access token passes the 008 owner policies, which compare the
-- folder with the token's sub. Anything the browser misses is swept by the
-- operator (DEPLOY.md, "Leftover photos").
--
-- Everything else is unchanged from 010: the id comes from the session,
-- never from an argument; a repeat call only makes sure the sign-in is gone.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb;
  v_signed_in_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Sign in to delete your account'
      using errcode = '42501';
  end if;

  -- When this session last proved who it is (see the header)
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    v_claims := null;
  end;
  if jsonb_typeof(v_claims -> 'amr') = 'array' then
    select to_timestamp(max((e ->> 'timestamp')::double precision))
      into v_signed_in_at
      from jsonb_array_elements(v_claims -> 'amr') as e
     where jsonb_typeof(e) = 'object'
       and jsonb_typeof(e -> 'timestamp') = 'number'
       and coalesce(e ->> 'method', '') <> 'token_refresh';
  end if;
  if v_signed_in_at is null then
    select u.last_sign_in_at into v_signed_in_at from auth.users u where u.id = v_uid;
  end if;

  if v_signed_in_at is null or v_signed_in_at < now() - interval '10 minutes' then
    raise exception 'Confirm it''s you again'
      using errcode = '28000',
            hint = 'reauth_required',
            detail = 'Deleting an account needs a sign-in from the last 10 minutes.';
  end if;

  -- Serialize repeat taps or two open tabs for the same person
  perform pg_advisory_xact_lock(hashtext('delete_my_account:' || v_uid::text));

  if not exists (select 1 from public.users where id = v_uid::text) then
    -- Already deleted (or the profile never got created): just make sure
    -- the sign-in identity is gone too.
    delete from auth.users where id = v_uid;
    return;
  end if;

  -- See 010: clear the session claims for the rest of this transaction so
  -- the 004/006 row guards treat delete_account as the trusted operator path.
  -- The id was captured above and is the only account touched.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  perform public.delete_account(v_uid::text);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.delete_account(text) from public, anon, authenticated;
