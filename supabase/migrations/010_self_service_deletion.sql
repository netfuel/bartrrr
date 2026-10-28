-- 010: self-service account deletion
--
-- Lets a signed-in neighbor delete their own account from Settings. It runs
-- the same steps as the operator function from migration 007
-- (public.delete_account), for the caller only: the id comes from the
-- session (auth.uid()), never from an argument, so nobody can name someone
-- else's account.
--
-- Photos: Supabase blocks deleting storage files from SQL, so the app
-- removes the caller's files in listing-photos/<user id>/ through the
-- Storage API before calling this. Anything it misses is swept by the
-- operator (see DEPLOY.md).
--
-- Abuse: the function can only ever act on the caller, so the worst a
-- stolen session can do is what the owner could do in Settings. The app asks
-- the neighbor to type DELETE first. Calling it twice is harmless: the second
-- call finds no profile and only makes sure the sign-in is gone.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to delete your account'
      using errcode = '42501';
  end if;

  -- Serialize repeat taps or two open tabs for the same person
  perform pg_advisory_xact_lock(hashtext('delete_my_account:' || v_uid::text));

  if not exists (select 1 from public.users where id = v_uid::text) then
    -- Already deleted (or the profile never got created): just make sure
    -- the sign-in identity is gone too.
    delete from auth.users where id = v_uid;
    return;
  end if;

  -- The row guards from 004/006 treat any request with auth.uid() set as a
  -- client edit (only the offer's sender may withdraw it, and so on), which
  -- would stop step 2 of delete_account. Clear the session claims for the
  -- rest of this transaction so it runs as the trusted operator path, the
  -- same as from the SQL editor. The id was captured above and is the only
  -- account touched.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  perform public.delete_account(v_uid::text);
end;
$$;

-- Supabase grants execute on new public functions to anon and authenticated
-- by default. Only signed-in neighbors may call this one.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- The operator function (any user id) stays out of the client API. 007
-- already revoked it; restated here so this file is safe on its own.
revoke all on function public.delete_account(text) from public, anon, authenticated;
