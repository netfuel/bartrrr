-- 007: account deletion
--
-- The privacy policy promises that deleting an account removes the
-- neighbor's profile and listings and takes their name off what remains,
-- while the other neighbor in a trade keeps their record.
--
-- public.users is not a foreign key of auth.users, and offers, messages,
-- agreements and reviews reference users without cascading, so deleting
-- the auth user alone would leave the profile behind. This function does
-- the whole job in one transaction.
--
-- Run it from the Supabase SQL editor (it is not callable from the app):
--   select public.delete_account('<user id>');

create or replace function public.delete_account(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_name text;
  v_first text;
begin
  select display_name, public.first_name(id) into v_name, v_first
    from public.users where id = p_user_id;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'No account with id %', p_user_id;
  end if;

  -- 1. Strip the profile first, so any notification sent below names
  --    "Former neighbor" rather than the person leaving.
  update public.users
     set username = 'former_' || substr(md5(id), 1, 12),
         display_name = 'Former neighbor',
         avatar_url = null,
         bio = null,
         interests = '{}',
         neighborhood = '',
         notification_prefs = '{}'::jsonb
   where id = p_user_id;

  -- 2. Close anything still open with other neighbors.
  update public.offers
     set status = 'withdrawn'
   where status in ('pending', 'countered')
     and (from_user_id = p_user_id or to_user_id = p_user_id);

  update public.agreements
     set status = 'cancelled'
   where status in ('draft', 'under_review', 'pending_signatures', 'active')
     and (party_a_user_id = p_user_id or party_b_user_id = p_user_id);

  -- 3. Listings: delete those nobody made an offer on. The rest are part of
  --    another neighbor's trade history, so take them down and clear them.
  delete from public.listings l
   where l.user_id = p_user_id
     and not exists (select 1 from public.offers o where o.listing_id = l.id);

  update public.listings
     set status = 'withdrawn',
         description = '',
         images = '{}'
   where user_id = p_user_id;

  -- 4. Take their name out of notifications other neighbors already got
  --    about trades with them ("Ann wants to trade..." -> "A former neighbor...").
  update public.notifications n
     set title = replace(replace(n.title, v_name, 'A former neighbor'), v_first, 'A former neighbor'),
         body  = replace(replace(n.body,  v_name, 'A former neighbor'), v_first, 'A former neighbor')
   where n.user_id <> p_user_id
     and (n.offer_id in (select o.id from public.offers o
                          where o.from_user_id = p_user_id or o.to_user_id = p_user_id)
          or n.agreement_id in (select a.id from public.agreements a
                                 where a.party_a_user_id = p_user_id or a.party_b_user_id = p_user_id))
     and (position(v_first in n.title) > 0 or position(v_first in n.body) > 0);

  -- 5. Private data that only this person could see.
  delete from public.notifications where user_id = p_user_id;
  delete from public.push_subscriptions where user_id = p_user_id;

  -- 6. The sign-in identity (email, password, Google or Apple link).
  delete from auth.users where id = p_user_id::uuid;
end;
$$;

revoke all on function public.delete_account(text) from public, anon, authenticated;
