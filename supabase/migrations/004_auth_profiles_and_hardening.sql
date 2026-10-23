-- ════════════════════════════════════════════════════════════════════════════
-- 004 — OAuth profiles, RLS hardening, server-side trade rules
--
--  1. Profile row auto-created for every new auth user (email, Google, Apple)
--  2. Column-level privileges: clients can't write reputation / trade counts
--  3. Listings: 30-day expiry, neighborhood-level coordinates only
--  4. Offers: 72h expiry, 5-round counter cap, valid state transitions only
--  5. Offer messages / agreements / reviews: parties-only writes with
--     integrity checks (no signing for the other party, no reviewing a
--     trade you weren't in, etc.)
--  6. Notifications are generated server-side (clients can only mark read)
--  7. Reputation + trade count maintained by triggers
--  8. Length limits on user-generated text
--
-- Every "client request" guard keys off auth.uid(): when it is null the
-- statement comes from a trusted context (service role, cron, migrations)
-- and the guard is skipped.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Profiles for new auth users ─────────────────────────────────────────

create or replace function public.create_profile_for_auth_user(
  p_id uuid,
  p_email text,
  p_meta jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_name text;
  v_avatar text;
  v_base text;
  v_username text;
begin
  if exists (select 1 from public.users where id = p_id::text) then
    return;
  end if;

  -- Google: full_name / name / avatar_url / picture.
  -- Apple: usually no name at all (only on the very first consent), and the
  -- email may be a private relay address — never use that as a name.
  v_name := nullif(trim(coalesce(
    meta->>'full_name',
    meta->>'name',
    concat_ws(' ', meta->>'given_name', meta->>'family_name')
  )), '');
  if v_name is null
     and p_email is not null
     and p_email not ilike '%@privaterelay.appleid.com' then
    v_name := nullif(initcap(regexp_replace(split_part(p_email, '@', 1), '[._+-]+', ' ', 'g')), '');
  end if;
  v_name := left(coalesce(v_name, 'Neighbor'), 60);

  v_avatar := coalesce(meta->>'avatar_url', meta->>'picture');
  if v_avatar is not null and v_avatar !~ '^https://' then
    v_avatar := null;
  end if;

  v_base := lower(regexp_replace(
    coalesce(meta->>'user_name', meta->>'preferred_username', v_name),
    '[^a-zA-Z0-9]+', '_', 'g'));
  v_base := trim(both '_' from left(v_base, 20));
  if v_base is null or char_length(v_base) < 2 then
    v_base := 'neighbor';
  end if;
  v_username := v_base;
  while exists (select 1 from public.users where username = v_username) loop
    v_username := v_base || '_' || substr(md5(random()::text), 1, 5);
  end loop;

  insert into public.users (id, username, display_name, avatar_url, neighborhood)
  values (p_id::text, v_username, v_name, v_avatar, '')
  on conflict (id) do nothing;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A profile hiccup must never block sign-up; the client creates the row
  -- itself on first load if it's missing.
  begin
    perform public.create_profile_for_auth_user(new.id, new.email, new.raw_user_meta_data);
  exception when others then
    raise warning 'create_profile_for_auth_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill any auth users that signed up before this trigger existed
do $$
declare
  u record;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where not exists (select 1 from public.users p where p.id = au.id::text)
  loop
    perform public.create_profile_for_auth_user(u.id, u.email, u.raw_user_meta_data);
  end loop;
end;
$$;

-- These run with elevated rights — never expose them through the REST RPC API
revoke all on function public.create_profile_for_auth_user(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;


-- ─── 2. Users: column-level write privileges ────────────────────────────────
-- reputation_score / trade_count / joined_at are maintained by the server.

revoke insert, update on public.users from anon, authenticated;
grant insert (id, username, display_name, avatar_url, bio, neighborhood, interests, notification_prefs)
  on public.users to authenticated;
grant update (username, display_name, avatar_url, bio, neighborhood, interests, notification_prefs)
  on public.users to authenticated;

drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile"
  on public.users for update
  using (auth.uid()::text = id)
  with check (auth.uid()::text = id);

alter table public.users
  add constraint users_display_name_len check (char_length(display_name) between 1 and 60) not valid,
  add constraint users_username_format check (username ~ '^[a-z0-9_]{2,32}$') not valid,
  add constraint users_bio_len check (bio is null or char_length(bio) <= 500) not valid,
  add constraint users_neighborhood_len check (char_length(neighborhood) <= 80) not valid,
  add constraint users_avatar_https check (avatar_url is null or avatar_url ~ '^https://') not valid,
  add constraint users_interests_count check (cardinality(interests) <= 32) not valid;


-- ─── 3. Listings: expiry + neighborhood-level location ──────────────────────

alter table public.listings add column if not exists expires_at timestamptz;
-- Existing listings get a fresh 30-day window from the day this ships
update public.listings
  set expires_at = greatest(created_at, now()) + interval '30 days'
  where expires_at is null;
alter table public.listings
  alter column expires_at set default (now() + interval '30 days'),
  alter column expires_at set not null;

create index if not exists listings_expires_at_idx on public.listings(expires_at);

alter table public.listings
  add constraint listings_title_len check (char_length(title) between 1 and 120) not valid,
  add constraint listings_description_len check (char_length(description) <= 4000) not valid,
  add constraint listings_seeking_len check (char_length(seeking) between 1 and 1000) not valid,
  add constraint listings_images_count check (cardinality(images) <= 6) not valid,
  add constraint listings_neighborhood_len check (char_length(neighborhood) <= 80) not valid;

create or replace function public.listings_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Never store more precise than ~1 km. The PRD only allows neighborhood-
  -- level location in public; exact meetup spots live on the agreement.
  if new.lat is not null then new.lat := round(new.lat::numeric, 2); end if;
  if new.lng is not null then new.lng := round(new.lng::numeric, 2); end if;

  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'active';
    new.created_at := now();
    new.expires_at := now() + interval '30 days';
    new.distance_mi := 0;
    return new;
  end if;

  -- UPDATE
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.distance_mi := old.distance_mi;
  if new.status = 'active' and (old.status <> 'active' or old.expires_at <= now()) then
    -- (Re)activating a listing renews it for another 30 days
    new.expires_at := now() + interval '30 days';
  else
    new.expires_at := old.expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard
  before insert or update on public.listings
  for each row execute function public.listings_guard();

-- Coarsen coordinates already stored
update public.listings
  set lat = round(lat::numeric, 2), lng = round(lng::numeric, 2)
  where lat is not null or lng is not null;

drop policy if exists "Owner update listing" on public.listings;
create policy "Owner update listing"
  on public.listings for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);


-- ─── 4. Offers: expiry, round cap, valid transitions ────────────────────────

alter table public.offers drop constraint if exists offers_status_check;
alter table public.offers
  add constraint offers_status_check
  check (status in ('pending', 'countered', 'accepted', 'declined', 'withdrawn', 'expired'));

update public.offers
  set expires_at = created_at + interval '72 hours'
  where expires_at is null;
alter table public.offers
  alter column expires_at set default (now() + interval '72 hours'),
  alter column expires_at set not null;

-- Whose turn it is: the party who made the latest offer/counter waits.
alter table public.offers add column if not exists last_actor_id text references public.users(id);
update public.offers o
  set last_actor_id = coalesce((
    select m.from_user_id from public.offer_messages m
    where m.offer_id = o.id and m.type in ('offer', 'counter')
    order by m.created_at desc limit 1
  ), o.from_user_id)
  where last_actor_id is null;

alter table public.offers
  add constraint offers_round_cap check (round >= 1 and round <= max_rounds) not valid,
  add constraint offers_max_rounds check (max_rounds between 1 and 5) not valid,
  add constraint offers_distinct_parties check (from_user_id <> to_user_id) not valid;

drop policy if exists "Offer creator insert" on public.offers;
create policy "Offer creator insert"
  on public.offers for insert
  with check (
    auth.uid()::text = from_user_id
    and from_user_id <> to_user_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.user_id = to_user_id
        and l.status = 'active'
        and l.expires_at > now()
    )
  );

drop policy if exists "Offer parties update" on public.offers;
create policy "Offer parties update"
  on public.offers for update
  using (auth.uid()::text = from_user_id or auth.uid()::text = to_user_id)
  with check (auth.uid()::text = from_user_id or auth.uid()::text = to_user_id);

create or replace function public.offers_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uid text := auth.uid()::text;
  v_last_mover text;
begin
  if v_uid is null then
    if tg_op = 'INSERT' and new.last_actor_id is null then
      new.last_actor_id := new.from_user_id;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.last_actor_id := new.from_user_id;
    new.status := 'pending';
    new.round := 1;
    new.max_rounds := 5;
    new.expires_at := now() + interval '72 hours';
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE: identity of the trade never changes
  new.listing_id := old.listing_id;
  new.from_user_id := old.from_user_id;
  new.to_user_id := old.to_user_id;
  new.max_rounds := old.max_rounds;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.last_actor_id := old.last_actor_id;

  if new.status is not distinct from old.status and new.round = old.round then
    new.expires_at := old.expires_at;
    return new;
  end if;

  if old.status not in ('pending', 'countered') then
    raise exception 'This offer is already %', old.status using errcode = 'P0001';
  end if;
  if old.expires_at <= now() then
    raise exception 'This offer has expired' using errcode = 'P0001';
  end if;

  -- Whoever made the latest offer/counter is waiting on the other side
  v_last_mover := coalesce(old.last_actor_id, old.from_user_id);

  case new.status
    when 'withdrawn' then
      if v_uid <> old.from_user_id then
        raise exception 'Only the person who made the offer can withdraw it' using errcode = 'P0001';
      end if;
      new.round := old.round;
      new.expires_at := old.expires_at;
    when 'accepted', 'declined' then
      if v_uid = v_last_mover then
        raise exception 'Waiting on the other neighbor to respond' using errcode = 'P0001';
      end if;
      new.round := old.round;
      new.expires_at := old.expires_at;
    when 'countered' then
      if v_uid = v_last_mover then
        raise exception 'Waiting on the other neighbor to respond' using errcode = 'P0001';
      end if;
      if new.round <> old.round + 1 or new.round > old.max_rounds then
        raise exception 'Counter-offers are limited to % rounds', old.max_rounds using errcode = 'P0001';
      end if;
      -- A response restarts the 72-hour clock and passes the turn
      new.expires_at := now() + interval '72 hours';
      new.last_actor_id := v_uid;
    else
      raise exception 'Invalid offer status change' using errcode = 'P0001';
  end case;

  return new;
end;
$$;

drop trigger if exists offers_guard on public.offers;
create trigger offers_guard
  before insert or update on public.offers
  for each row execute function public.offers_guard();

-- Accepting an offer puts the listing on hold
create or replace function public.offers_after_accept()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.listings set status = 'pending'
      where id = new.listing_id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists offers_after_accept on public.offers;
create trigger offers_after_accept
  after update on public.offers
  for each row execute function public.offers_after_accept();

-- Sweep stale offers. Scheduled below with pg_cron when available; the app
-- also treats past-due offers as expired client-side.
create or replace function public.expire_stale_offers()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with expired as (
    update public.offers
      set status = 'expired', updated_at = now()
      where status in ('pending', 'countered') and expires_at <= now()
      returning 1
  )
  select count(*)::integer from expired;
$$;
revoke all on function public.expire_stale_offers() from public, anon, authenticated;


-- ─── 5a. Offer messages ─────────────────────────────────────────────────────

alter table public.offer_messages
  add constraint offer_messages_content_len check (char_length(content) between 1 and 2000) not valid,
  add constraint offer_messages_items_count check (cardinality(items) <= 10) not valid;

drop policy if exists "Offer message parties insert" on public.offer_messages;
create policy "Offer message parties insert"
  on public.offer_messages for insert
  with check (
    auth.uid()::text = from_user_id
    and exists (
      select 1 from public.offers o
      where o.id = offer_id
        and (auth.uid()::text = o.from_user_id or auth.uid()::text = o.to_user_id)
    )
  );

create or replace function public.offer_messages_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists offer_messages_guard on public.offer_messages;
create trigger offer_messages_guard
  before insert on public.offer_messages
  for each row execute function public.offer_messages_guard();


-- ─── 5b. Agreements ─────────────────────────────────────────────────────────

create unique index if not exists agreements_offer_id_key on public.agreements(offer_id);

alter table public.agreements
  add constraint agreements_items_len check (
    char_length(party_a_item) <= 1000 and char_length(party_b_item) <= 1000
  ) not valid,
  add constraint agreements_terms_len check (
    (exchange_location is null or char_length(exchange_location) <= 300)
    and (special_instructions is null or char_length(special_instructions) <= 1000)
    and (exchange_date is null or char_length(exchange_date) <= 64)
  ) not valid;

drop policy if exists "Agreement insert" on public.agreements;
create policy "Agreement insert"
  on public.agreements for insert
  with check (
    (auth.uid()::text = party_a_user_id or auth.uid()::text = party_b_user_id)
    and exists (
      select 1 from public.offers o
      where o.id = offer_id
        and o.status = 'accepted'
        and o.from_user_id = party_a_user_id
        and o.to_user_id = party_b_user_id
    )
  );

drop policy if exists "Agreement parties update" on public.agreements;
create policy "Agreement parties update"
  on public.agreements for update
  using (auth.uid()::text = party_a_user_id or auth.uid()::text = party_b_user_id)
  with check (auth.uid()::text = party_a_user_id or auth.uid()::text = party_b_user_id);

create or replace function public.agreements_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uid text := auth.uid()::text;
  v_terms_changed boolean;
begin
  if v_uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.party_a_signed := false;
    new.party_b_signed := false;
    new.status := 'pending_signatures';
    new.created_at := now();
    new.completed_at := null;
    return new;
  end if;

  -- UPDATE
  new.offer_id := old.offer_id;
  new.party_a_user_id := old.party_a_user_id;
  new.party_b_user_id := old.party_b_user_id;
  new.created_at := old.created_at;

  v_terms_changed :=
    new.party_a_item is distinct from old.party_a_item
    or new.party_b_item is distinct from old.party_b_item
    or new.exchange_method is distinct from old.exchange_method
    or new.exchange_date is distinct from old.exchange_date
    or new.exchange_location is distinct from old.exchange_location
    or new.special_instructions is distinct from old.special_instructions;

  if v_terms_changed then
    if old.status not in ('draft', 'under_review', 'pending_signatures') then
      raise exception 'Terms can''t change after both neighbors have signed' using errcode = 'P0001';
    end if;
    -- Any edit has to be re-approved by both sides
    new.party_a_signed := false;
    new.party_b_signed := false;
  else
    -- You can only add your own signature, and never take it back
    if new.party_a_signed is distinct from old.party_a_signed
       and (v_uid <> old.party_a_user_id or new.party_a_signed is not true) then
      raise exception 'You can only sign for yourself' using errcode = 'P0001';
    end if;
    if new.party_b_signed is distinct from old.party_b_signed
       and (v_uid <> old.party_b_user_id or new.party_b_signed is not true) then
      raise exception 'You can only sign for yourself' using errcode = 'P0001';
    end if;
    if (new.party_a_signed and not old.party_a_signed)
       or (new.party_b_signed and not old.party_b_signed) then
      if old.status not in ('draft', 'under_review', 'pending_signatures') then
        raise exception 'This agreement is no longer open for signatures' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'active' then
        null; -- validated below: only reachable with both signatures
      when 'completed' then
        if old.status <> 'active' then
          raise exception 'Only an active trade can be completed' using errcode = 'P0001';
        end if;
      when 'cancelled' then
        if old.status not in ('draft', 'under_review', 'pending_signatures', 'active') then
          raise exception 'This agreement can''t be cancelled' using errcode = 'P0001';
        end if;
      when 'disputed' then
        if old.status not in ('active', 'completed') then
          raise exception 'Only active or completed trades can be disputed' using errcode = 'P0001';
        end if;
      when 'pending_signatures', 'under_review', 'draft' then
        if old.status not in ('draft', 'under_review', 'pending_signatures') then
          raise exception 'Invalid agreement status change' using errcode = 'P0001';
        end if;
      else
        raise exception 'Invalid agreement status change' using errcode = 'P0001';
    end case;
  end if;

  -- Both signatures move a pending agreement to active automatically
  if new.status in ('draft', 'under_review', 'pending_signatures', 'active')
     and old.status in ('draft', 'under_review', 'pending_signatures') then
    if new.party_a_signed and new.party_b_signed then
      new.status := 'active';
    elsif new.status = 'active' then
      raise exception 'Both neighbors need to sign first' using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
  else
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists agreements_guard on public.agreements;
create trigger agreements_guard
  before insert or update on public.agreements
  for each row execute function public.agreements_guard();

-- Completing a trade: bump both trade counts, close the listing
create or replace function public.agreements_after_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.users
      set trade_count = coalesce(trade_count, 0) + 1
      where id in (new.party_a_user_id, new.party_b_user_id);
    update public.listings
      set status = 'completed'
      where id = (select listing_id from public.offers where id = new.offer_id)
        and status in ('active', 'pending');
  end if;
  return new;
end;
$$;

drop trigger if exists agreements_after_complete on public.agreements;
create trigger agreements_after_complete
  after update on public.agreements
  for each row execute function public.agreements_after_complete();


-- ─── 5c. Reviews ────────────────────────────────────────────────────────────

alter table public.reviews
  add constraint reviews_comment_len check (comment is null or char_length(comment) <= 1000) not valid,
  add constraint reviews_not_self check (reviewer_id <> reviewee_id) not valid;

drop policy if exists "Reviewer insert" on public.reviews;
create policy "Reviewer insert"
  on public.reviews for insert
  with check (
    auth.uid()::text = reviewer_id
    and reviewer_id <> reviewee_id
    and exists (
      select 1 from public.agreements a
      where a.id = agreement_id
        and a.status = 'completed'
        and (
          (a.party_a_user_id = reviewer_id and a.party_b_user_id = reviewee_id)
          or (a.party_b_user_id = reviewer_id and a.party_a_user_id = reviewee_id)
        )
    )
  );

create or replace function public.reviews_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.users
    set reputation_score = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.reviewee_id = new.reviewee_id
    ), 5.0)
    where id = new.reviewee_id;
  return new;
end;
$$;

drop trigger if exists reviews_after_insert on public.reviews;
create trigger reviews_after_insert
  after insert on public.reviews
  for each row execute function public.reviews_after_insert();

create or replace function public.reviews_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard
  before insert on public.reviews
  for each row execute function public.reviews_guard();


-- ─── 6. Notifications: server-generated, clients may only mark read ─────────

drop policy if exists "Own notifications" on public.notifications;
create policy "Own notifications read"
  on public.notifications for select
  using (auth.uid()::text = user_id);
create policy "Own notifications mark read"
  on public.notifications for update
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
create policy "Own notifications delete"
  on public.notifications for delete
  using (auth.uid()::text = user_id);

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(
  p_user_id text,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb,
  p_listing_id text default null,
  p_offer_id text default null,
  p_agreement_id text default null
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, type, title, body, data, listing_id, offer_id, agreement_id)
  values (p_user_id, p_type, left(p_title, 120), left(p_body, 300), coalesce(p_data, '{}'::jsonb),
          p_listing_id, p_offer_id, p_agreement_id);
$$;
revoke all on function public.notify(text, text, text, text, jsonb, text, text, text) from public, anon, authenticated;

create or replace function public.first_name(p_user_id text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(split_part(display_name, ' ', 1), 'A neighbor')
  from public.users where id = p_user_id;
$$;
revoke all on function public.first_name(text) from public, anon, authenticated;

create or replace function public.notify_offer_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := auth.uid()::text;
  v_other text;
  v_listing_title text;
begin
  select title into v_listing_title from public.listings where id = new.listing_id;

  if tg_op = 'INSERT' then
    perform public.notify(new.to_user_id, 'new_offer', 'New offer received',
      coalesce(public.first_name(new.from_user_id), 'A neighbor') || ' wants to trade for your ' || coalesce(v_listing_title, 'listing'),
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
    return new;
  end if;

  if new.status is not distinct from old.status and new.round = old.round then
    return new;
  end if;

  v_other := case when v_actor = new.from_user_id then new.to_user_id else new.from_user_id end;

  if new.status = 'accepted' then
    perform public.notify(v_other, 'offer_accepted', 'Offer accepted!',
      coalesce(public.first_name(v_actor), 'Your neighbor') || ' accepted the trade. Review and sign the agreement.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  elsif new.status = 'declined' then
    perform public.notify(v_other, 'offer_declined', 'Offer declined',
      coalesce(public.first_name(v_actor), 'Your neighbor') || ' passed on this trade.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  elsif new.status = 'countered' then
    perform public.notify(v_other, 'counter_offer', 'Counter offer received',
      coalesce(public.first_name(v_actor), 'Your neighbor') || ' suggested a change to the trade.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  elsif new.status = 'expired' then
    perform public.notify(new.from_user_id, 'offer_declined', 'Offer expired',
      'Your offer on ' || coalesce(v_listing_title, 'a listing') || ' expired without a response.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_offer_change on public.offers;
create trigger notify_offer_change
  after insert or update on public.offers
  for each row execute function public.notify_offer_change();

create or replace function public.notify_offer_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.offers%rowtype;
  v_other text;
begin
  if new.type <> 'message' then
    return new;
  end if;
  select * into o from public.offers where id = new.offer_id;
  if not found then
    return new;
  end if;
  v_other := case when new.from_user_id = o.from_user_id then o.to_user_id else o.from_user_id end;
  perform public.notify(v_other, 'new_message', 'New message',
    coalesce(public.first_name(new.from_user_id), 'A neighbor') || ': ' || left(new.content, 80),
    jsonb_build_object('offerId', o.id), o.listing_id, o.id, null);
  return new;
end;
$$;

drop trigger if exists notify_offer_message on public.offer_messages;
create trigger notify_offer_message
  after insert on public.offer_messages
  for each row execute function public.notify_offer_message();

create or replace function public.notify_agreement_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := auth.uid()::text;
  v_other text;
begin
  v_other := case when v_actor = new.party_a_user_id then new.party_b_user_id else new.party_a_user_id end;

  if tg_op = 'INSERT' then
    perform public.notify(v_other, 'agreement_ready', 'Trade agreement ready',
      'Review the terms and sign when you''re ready.',
      jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
    return new;
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.notify(v_other, 'trade_complete', 'Trade completed!',
      'Your trade has been marked as complete. Leave a review!',
      jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
  elsif (new.party_a_signed and not old.party_a_signed) or (new.party_b_signed and not old.party_b_signed) then
    perform public.notify(v_other, 'agreement_ready',
      case when new.status = 'active' then 'Agreement fully signed!' else 'Agreement signed' end,
      coalesce(public.first_name(v_actor), 'Your neighbor') ||
        case when new.status = 'active' then ' signed too. The trade is on!' else ' signed the trade agreement. Your turn!' end,
      jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_agreement_change on public.agreements;
create trigger notify_agreement_change
  after insert or update on public.agreements
  for each row execute function public.notify_agreement_change();

create or replace function public.notify_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.notify(new.reviewee_id, 'review_request', 'New review received',
    coalesce(public.first_name(new.reviewer_id), 'A neighbor') || ' left you a review.',
    jsonb_build_object('agreementId', new.agreement_id), null, null, new.agreement_id);
  return new;
end;
$$;

drop trigger if exists notify_review on public.reviews;
create trigger notify_review
  after insert on public.reviews
  for each row execute function public.notify_review();

-- Trigger functions are only ever invoked by triggers
revoke all on function public.listings_guard() from public, anon, authenticated;
revoke all on function public.offers_guard() from public, anon, authenticated;
revoke all on function public.offers_after_accept() from public, anon, authenticated;
revoke all on function public.offer_messages_guard() from public, anon, authenticated;
revoke all on function public.agreements_guard() from public, anon, authenticated;
revoke all on function public.agreements_after_complete() from public, anon, authenticated;
revoke all on function public.reviews_after_insert() from public, anon, authenticated;
revoke all on function public.reviews_guard() from public, anon, authenticated;
revoke all on function public.notify_offer_change() from public, anon, authenticated;
revoke all on function public.notify_offer_message() from public, anon, authenticated;
revoke all on function public.notify_agreement_change() from public, anon, authenticated;
revoke all on function public.notify_review() from public, anon, authenticated;


-- ─── 7. Push subscriptions: explicit WITH CHECK ─────────────────────────────

drop policy if exists "Own push subscriptions" on public.push_subscriptions;
create policy "Own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);


-- ─── 8. Schedule the offer-expiry sweep (best effort) ───────────────────────

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('bartrrr-expire-offers', '*/15 * * * *', 'select public.expire_stale_offers()');
  else
    raise notice 'pg_cron not available — schedule public.expire_stale_offers() manually';
  end if;
exception when others then
  raise notice 'Could not schedule offer expiry (%). Enable pg_cron and schedule public.expire_stale_offers().', sqlerrm;
end;
$$;
