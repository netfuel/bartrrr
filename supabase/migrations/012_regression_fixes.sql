-- ════════════════════════════════════════════════════════════════════════════
-- 012 — Regression fixes T-19 to T-27 (found by supabase/tests, layer 1)
--
--   T-22  notify() honors users.notification_prefs (sections first: later
--         sections call notify() / notify_always())
--   T-19  one listing, one trade: accepting needs an active listing; the
--         listing's other open offers are declined ("accepted_another")
--   T-20  canceling a trade puts its listing back up (30 days, like relisting)
--   T-21  repeating accept / decline / counter on a closed offer is refused
--   T-27  offer / counter / accept / decline thread messages come only from
--         the offer RPCs, never from a direct insert
--   T-23  'match' notifications are created server-side on new listings
--   T-24  account deletion redacts the leaving neighbor's name by template,
--   T-25  and any remaining name match is whole-word only
--   T-26  users.notification_prefs is readable only by its owner
--
-- Redefines functions from 004, 005, 007, 009 and 011 with create or
-- replace; 001–011 are not edited. Safe to run twice: every statement is
-- create or replace, drop ... if exists, a grant / revoke, or an idempotent
-- update.
--
-- Like 004 and 009, client rules key off auth.uid(): when it is null the
-- statement comes from a trusted context (service role, SQL editor, pg_cron,
-- delete_account) and client-only rules are skipped.
--
-- Supabase grants execute on every new public function to anon and
-- authenticated by default, so each new function below is revoked
-- explicitly unless it is meant to be an RPC.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── T-22 notification preferences ──────────────────────────────────────────
-- Settings → Notifications (src/pages/SettingsPage.tsx) stores five keys in
-- users.notification_prefs. Mapping to notification types:
--   newOffers         new_offer, counter_offer
--   messages          new_message
--   agreementUpdates  agreement_ready ("your turn to sign", "details changed")
--   tradeCompletions  trade_complete, review_request
--   perfectMatches    match
-- A missing key (or anything but JSON false) means on, like 001's default
-- and the client's mapUserRow(). Types with no setting (offer_accepted,
-- offer_declined: accepted, declined, withdrawn, expired) are always sent.
--
-- Never skipped: "Trade canceled" and "Trade flagged for review". They share
-- the agreement_ready type but tell a neighbor that a meetup is off or a
-- trade is in dispute, which they must not miss. notify_agreement_change()
-- sends them through notify_always().

create or replace function public.notification_pref_key(p_type text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_type
    when 'new_offer'       then 'newOffers'
    when 'counter_offer'   then 'newOffers'
    when 'new_message'     then 'messages'
    when 'agreement_ready' then 'agreementUpdates'
    when 'trade_complete'  then 'tradeCompletions'
    when 'review_request'  then 'tradeCompletions'
    when 'match'           then 'perfectMatches'
  end;
$$;

-- Inserts unconditionally. Also records who caused the notification
-- (data.actorId = the signed-in neighbor, when it isn't the recipient), so
-- account deletion can find every notification a neighbor's actions produced
-- (T-24). Trusted contexts have no actor and record none.
create or replace function public.notify_always(
  p_user_id text,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb,
  p_listing_id text default null,
  p_offer_id text default null,
  p_agreement_id text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_actor text := auth.uid()::text;
begin
  if p_user_id is null then
    return;
  end if;
  if v_actor is not null and v_actor <> p_user_id and not (v_data ? 'actorId') then
    v_data := v_data || jsonb_build_object('actorId', v_actor);
  end if;
  insert into public.notifications (user_id, type, title, body, data, listing_id, offer_id, agreement_id)
  values (p_user_id, p_type, left(p_title, 120), left(p_body, 300), v_data,
          p_listing_id, p_offer_id, p_agreement_id);
end;
$$;

-- Same signature as 004, so every existing caller now honors preferences.
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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := public.notification_pref_key(p_type);
  v_pref jsonb;
begin
  if v_key is not null then
    select u.notification_prefs -> v_key into v_pref from public.users u where u.id = p_user_id;
    if v_pref = 'false'::jsonb then
      return;
    end if;
  end if;
  perform public.notify_always(p_user_id, p_type, p_title, p_body, p_data,
                               p_listing_id, p_offer_id, p_agreement_id);
end;
$$;

-- 009's notify_agreement_change(), with cancel and flag sent through
-- notify_always() (see above). Every other branch is unchanged.
create or replace function public.notify_agreement_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := auth.uid()::text;
  v_other text;
  v_name text;
begin
  v_other := case when v_actor = new.party_a_user_id then new.party_b_user_id else new.party_a_user_id end;
  v_name := coalesce(nullif(public.first_name(v_actor), ''), 'Your neighbor');

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if v_actor is null then
      -- Trusted context (for example delete_account): tell both sides
      perform public.notify_always(p, 'agreement_ready', 'Trade canceled',
        'This trade agreement was canceled. Nothing more to do here.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id)
      from unnest(array[new.party_a_user_id, new.party_b_user_id]) as p;
    else
      perform public.notify_always(v_other, 'agreement_ready', 'Trade canceled',
        v_name || ' canceled your trade agreement. Message them if you want to try again.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
    end if;
  elsif new.status = 'disputed' and old.status is distinct from 'disputed' then
    if v_actor is not null then
      perform public.notify_always(v_other, 'agreement_ready', 'Trade flagged for review',
        v_name || ' flagged your trade: “' || left(new.dispute_reason, 120)
          || '” Talk it through with them in your messages.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
    end if;
  elsif new.status = 'completed' and old.status is distinct from 'completed' and old.completed_at is null then
    perform public.notify(v_other, 'trade_complete', 'Trade complete',
      v_name || ' marked your trade as done. How did it go? Leave a review.',
      jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
  elsif v_actor is not null and new.terms_updated_at is distinct from old.terms_updated_at then
    perform public.notify(v_other, 'agreement_ready', 'Trade details changed',
      v_name || ' changed the time and place. Review the agreement and sign again.',
      jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
  elsif (new.party_a_signed and not old.party_a_signed) or (new.party_b_signed and not old.party_b_signed) then
    if new.status = 'active' then
      perform public.notify(v_other, 'agreement_ready', 'You''re both signed: time to swap',
        'You both signed the trade agreement. Meet up and make the swap.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
    else
      perform public.notify(v_other, 'agreement_ready', 'Your turn to sign',
        'Your neighbor signed the trade agreement. Review it and sign to lock in the trade.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.notification_pref_key(text) from public, anon, authenticated;
revoke all on function public.notify_always(text, text, text, text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.notify(text, text, text, text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.notify_agreement_change() from public, anon, authenticated;


-- ─── T-19 one listing, one trade ────────────────────────────────────────────
-- 004's offers_after_accept() put the listing on hold only "where status =
-- 'active'" and drafted the agreement regardless, so a second offer on a
-- listing already on hold could be accepted: two agreements for one item.
--
-- Now, accepting an offer:
--   • locks the listing row and refuses unless it is 'active' (the lock
--     serializes two accepts racing on the same listing; the second sees
--     'pending' and fails);
--   • declines every other open offer on that listing in the owner's name
--     with the reason key 'accepted_another' (DECLINE_REASON_LABELS in
--     src/types/index.ts; 005's notify_offer_message() already turns it into
--     "I've already accepted another offer"). Each maker gets the usual
--     "Offer declined" notification.
-- The declines run as the trusted path (session claims cleared for the
-- duration, then restored): offers_guard's turn rules are for neighbors'
-- own moves, and would otherwise refuse when the acceptor happened to be
-- the last mover on another offer.

create or replace function public.offers_after_accept()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offered text;
  v_listing_title text;
  v_listing_status text;
  v_claims text;
  v_sub text;
  r record;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select title, status into v_listing_title, v_listing_status
      from public.listings where id = new.listing_id
      for update;
    if v_listing_status is distinct from 'active' then
      raise exception '%', case v_listing_status
          when 'pending' then 'This listing already has a trade in progress.'
          else 'This listing is no longer available.'
        end
        using errcode = 'P0001';
    end if;

    update public.listings set status = 'pending' where id = new.listing_id;

    select array_to_string(m.items, ', ') into v_offered
    from public.offer_messages m
    where m.offer_id = new.id and m.type in ('offer', 'counter')
    order by m.created_at desc
    limit 1;

    insert into public.agreements (id, offer_id, party_a_user_id, party_a_item, party_b_user_id, party_b_item)
    values (
      'agreement-' || new.id,
      new.id,
      new.from_user_id,
      left(coalesce(nullif(v_offered, ''), 'Offered items'), 1000),
      new.to_user_id,
      left(coalesce(v_listing_title, 'Listed item'), 1000)
    )
    on conflict (offer_id) do nothing;

    -- Decline the listing's other open offers as the trusted path
    v_claims := coalesce(current_setting('request.jwt.claims', true), '');
    v_sub := coalesce(current_setting('request.jwt.claim.sub', true), '');
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);

    for r in
      select o.id, o.to_user_id
        from public.offers o
       where o.listing_id = new.listing_id
         and o.id <> new.id
         and o.status in ('pending', 'countered')
       order by o.created_at
       for update
    loop
      update public.offers set status = 'declined', updated_at = now() where id = r.id;
      insert into public.offer_messages (offer_id, from_user_id, type, content)
      values (r.id, r.to_user_id, 'decline', 'accepted_another');
    end loop;

    perform set_config('request.jwt.claims', v_claims, true);
    perform set_config('request.jwt.claim.sub', v_sub, true);
  end if;
  return new;
end;
$$;

revoke all on function public.offers_after_accept() from public, anon, authenticated;


-- ─── T-20 canceling a trade puts the listing back up ────────────────────────
-- 009's agreements_after_cancel() plus: when an agreement is canceled, its
-- listing goes from 'pending' back to 'active' with a fresh 30 days (the
-- same renewal listings_guard gives a relisted listing), unless another
-- agreement on that listing is still open, flagged ('disputed') or done.
-- A flagged trade never reaches this branch: 'disputed' → 'cancelled' is
-- refused by agreements_guard, and flagging itself leaves the listing as is.

create or replace function public.agreements_after_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if new.cancelled_late and new.cancelled_by is not null then
      update public.users
        set late_cancellations = coalesce(late_cancellations, 0) + 1
        where id = new.cancelled_by;
    end if;

    update public.listings l
       set status = 'active',
           expires_at = now() + interval '30 days'
     where l.id = (select o.listing_id from public.offers o where o.id = new.offer_id)
       and l.status = 'pending'
       and not exists (
         select 1
           from public.agreements a
           join public.offers o on o.id = a.offer_id
          where o.listing_id = l.id
            and a.id <> new.id
            and a.status in ('draft', 'under_review', 'pending_signatures', 'active', 'disputed', 'completed'));
  end if;
  return new;
end;
$$;

revoke all on function public.agreements_after_cancel() from public, anon, authenticated;


-- ─── T-21 / T-27 offer RPCs ─────────────────────────────────────────────────
-- T-21: offers_guard treats "status unchanged" as a no-op, so repeating an
-- accept or decline (double tap, retry, or the other neighbor answering a
-- closed offer) passed the guard and still wrote a thread message, which
-- sent a second "Offer declined" (or a decline "from" the offer's maker).
-- respond_to_offer() now locks the offer and refuses accept / decline /
-- counter unless it is still open: "This offer is already declined." The
-- turn rules for open offers stay in offers_guard. Withdraw keeps its 004
-- behavior: repeating it is a harmless no-op, and withdrawing a closed offer
-- is refused by offers_guard ("This offer is already accepted").
--
-- T-27 (decision): not intended. 004 writes each offer / counter / accept /
-- decline thread message together with its state change, in make_offer()
-- and respond_to_offer() ("writes the offer row and its thread message
-- together"), and offers_after_accept() trusts the latest 'offer' or
-- 'counter' message as what the maker gives. The app only ever inserts
-- type 'message' directly (addOfferMessage in supabase-service.ts). But the
-- insert policy let either party insert any type, so before acceptance
-- either neighbor could post an 'offer' message whose items became the
-- agreement's party_a_item: no round used, no turn passed, no
-- notification. A direct 'decline' or 'accept' message likewise sent
-- "Offer declined" without declining anything. Only the initial 'offer'
-- message, written by make_offer() in the same transaction as the offer,
-- is legitimate. So: non-'message' types are accepted only while one of the
-- two RPCs is writing (a transaction-local flag that only these functions
-- set; PostgREST can't set it) or from a trusted context.

create or replace function public.offer_messages_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.created_at := now();
    if new.type is distinct from 'message'
       and coalesce(current_setting('bartrrr.offer_rpc', true), '') <> 'on' then
      raise exception 'Use the offer buttons to make, counter, accept or decline an offer'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.make_offer(
  p_offer_id text,
  p_listing_id text,
  p_message_id text,
  p_content text,
  p_items text[]
) returns public.offers
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid text := auth.uid()::text;
  v_owner text;
  o public.offers;
begin
  if v_uid is null then
    raise exception 'Sign in to make an offer' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_items), 0) = 0 then
    raise exception 'Add at least one thing you''ll trade' using errcode = 'P0001';
  end if;

  select user_id into v_owner from public.listings where id = p_listing_id;
  if v_owner is null then
    raise exception 'That listing is no longer available' using errcode = 'P0001';
  end if;

  insert into public.offers (id, listing_id, from_user_id, to_user_id)
  values (
    coalesce(p_offer_id, 'offer-' || replace(gen_random_uuid()::text, '-', '')),
    p_listing_id, v_uid, v_owner
  )
  returning * into o;

  perform set_config('bartrrr.offer_rpc', 'on', true);
  insert into public.offer_messages (id, offer_id, from_user_id, type, content, items)
  values (
    coalesce(p_message_id, 'msg-' || replace(gen_random_uuid()::text, '-', '')),
    o.id, v_uid, 'offer', p_content, p_items
  );
  perform set_config('bartrrr.offer_rpc', '', true);

  return o;
end;
$$;

create or replace function public.respond_to_offer(
  p_offer_id text,
  p_action text,
  p_message_id text,
  p_content text,
  p_items text[] default '{}'
) returns public.offers
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid text := auth.uid()::text;
  v_status text;
  o public.offers;
begin
  if v_uid is null then
    raise exception 'Sign in to respond to offers' using errcode = '42501';
  end if;

  if p_action in ('accept', 'decline', 'counter') then
    -- RLS: only the two parties see the row; the lock makes a double tap
    -- wait for the first answer and then see it.
    select status into v_status from public.offers where id = p_offer_id for update;
    if not found then
      raise exception 'Offer not found' using errcode = 'P0001';
    end if;
    if v_status not in ('pending', 'countered') then
      raise exception 'This offer is already %.', v_status using errcode = 'P0001';
    end if;
  end if;

  case p_action
    when 'accept' then
      update public.offers set status = 'accepted' where id = p_offer_id returning * into o;
    when 'decline' then
      update public.offers set status = 'declined' where id = p_offer_id returning * into o;
    when 'counter' then
      if coalesce(cardinality(p_items), 0) = 0 then
        raise exception 'Add at least one thing to your counter-offer' using errcode = 'P0001';
      end if;
      update public.offers set status = 'countered', round = round + 1 where id = p_offer_id returning * into o;
    when 'withdraw' then
      update public.offers set status = 'withdrawn' where id = p_offer_id returning * into o;
    else
      raise exception 'Unknown offer action' using errcode = 'P0001';
  end case;

  if o.id is null then
    raise exception 'Offer not found' using errcode = 'P0001';
  end if;

  if p_action <> 'withdraw' then
    perform set_config('bartrrr.offer_rpc', 'on', true);
    insert into public.offer_messages (id, offer_id, from_user_id, type, content, items)
    values (
      coalesce(p_message_id, 'msg-' || replace(gen_random_uuid()::text, '-', '')),
      o.id, v_uid, p_action, p_content,
      case when p_action = 'counter' then p_items else '{}'::text[] end
    );
    perform set_config('bartrrr.offer_rpc', '', true);
  end if;

  return o;
end;
$$;

revoke all on function public.offer_messages_guard() from public, anon, authenticated;
revoke all on function public.make_offer(text, text, text, text, text[]) from public, anon;
revoke all on function public.respond_to_offer(text, text, text, text, text[]) from public, anon;
grant execute on function public.make_offer(text, text, text, text, text[]) to authenticated;
grant execute on function public.respond_to_offer(text, text, text, text, text[]) to authenticated;


-- ─── T-23 match notifications ───────────────────────────────────────────────
-- The client's rule (CreateListingPage) notified neighbors whose interests
-- include the new listing's category, but addNotification() is a no-op with
-- a backend, so nobody was ever told. This trigger does it server-side.
--
-- Vocabulary: listings.category is one of goods / services / skills /
-- outdoor, but onboarding (src/pages/OnboardingPage.tsx) stores the PRD's
-- finer interest ids (household, tools, tutoring, ...). Comparing them
-- directly never matches, so interest_categories() maps both vocabularies
-- to listing categories. Anything else (seed free text) matches nothing.
--
-- Who is told (at most 50 per listing, nearest first):
--   • not the poster; interests map to the listing's category;
--   • nearby: same neighborhood name, or neighborhood centers within 5 mi
--     (centers mirror src/data/neighborhoods.ts; listing point = its stored
--     coordinates, else its neighborhood's center). A neighborhood we
--     don't know only matches by name;
--   • perfectMatches not turned off (also enforced by notify());
--   • no match notification in the last hour (one per neighbor per hour).
-- Copy: docs/content-style-guide.md §9 and the client's demo wording.

create or replace function public.interest_categories(p_interests text[])
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct c), '{}')
    from (
      select case lower(btrim(i))
        when 'goods' then 'goods'
        when 'services' then 'services'
        when 'skills' then 'skills'
        when 'outdoor' then 'outdoor'
        -- OnboardingPage INTEREST_CATEGORIES
        when 'household' then 'goods'
        when 'electronics' then 'goods'
        when 'furniture' then 'goods'
        when 'clothing' then 'goods'
        when 'kids' then 'goods'
        when 'books' then 'goods'
        when 'tools' then 'goods'
        when 'food' then 'goods'
        when 'sports' then 'outdoor'
        when 'garden' then 'outdoor'
        when 'handyman' then 'services'
        when 'pets' then 'services'
        when 'transport' then 'services'
        when 'tutoring' then 'skills'
        when 'tech' then 'skills'
        when 'creative' then 'skills'
      end as c
      from unnest(coalesce(p_interests, '{}')) as i
    ) m
   where c is not null;
$$;

-- Approximate centers, same values as NEIGHBORHOOD_CENTERS in
-- src/data/neighborhoods.ts. Keep the two lists in step.
create or replace function public.neighborhood_center(p_name text, out lat numeric, out lng numeric)
language sql
immutable
set search_path = public, pg_temp
as $$
  select c.lat, c.lng
    from (values
      ('downtown memphis',         35.145, -90.051),
      ('midtown',                  35.137, -90.007),
      ('cooper-young',             35.119, -89.991),
      ('south main arts district', 35.133, -90.057),
      ('overton square',           35.149, -89.993),
      ('east memphis',             35.108, -89.900),
      ('germantown',               35.087, -89.810),
      ('cordova',                  35.156, -89.776),
      ('bartlett',                 35.205, -89.874),
      ('binghampton',              35.144, -89.960),
      ('whitehaven',               35.030, -90.020),
      ('collierville',             35.042, -89.665),
      ('harbor town',              35.158, -90.056),
      ('frayser',                  35.223, -90.008),
      ('millington',               35.342, -89.897),
      ('raleigh',                  35.203, -89.937)
    ) as c(name, lat, lng)
   where c.name = lower(btrim(p_name));
$$;

create or replace function public.listings_notify_matches()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lat numeric := new.lat;
  v_lng numeric := new.lng;
  v_hood text := lower(btrim(coalesce(new.neighborhood, '')));
  r record;
begin
  if new.status is distinct from 'active' or new.expires_at <= now() then
    return new;
  end if;
  if v_lat is null or v_lng is null then
    select c.lat, c.lng into v_lat, v_lng from public.neighborhood_center(new.neighborhood) c;
  end if;

  for r in
    select u.id
      from public.users u
      left join lateral public.neighborhood_center(u.neighborhood) uc on true
      cross join lateral (
        select case
          when v_lat is null or uc.lat is null then null
          else sqrt(power((uc.lat - v_lat) * 69.0, 2)
                    + power((uc.lng - v_lng) * 69.0 * cos(radians(v_lat)), 2))
        end as miles
      ) d
     where u.id <> new.user_id
       and new.category = any(public.interest_categories(u.interests))
       and btrim(coalesce(u.neighborhood, '')) <> ''
       and (lower(btrim(u.neighborhood)) = v_hood or d.miles <= 5)
       and coalesce(u.notification_prefs -> 'perfectMatches', 'true'::jsonb) <> 'false'::jsonb
       and not exists (
         select 1 from public.notifications n
          where n.user_id = u.id and n.type = 'match'
            and n.created_at > now() - interval '1 hour')
     order by coalesce(d.miles, 0), u.id
     limit 50
  loop
    perform public.notify(r.id, 'match', 'New listing you might like',
      'A neighbor just posted "' || left(new.title, 120) || '". It matches what you''re looking for.',
      jsonb_build_object('listingId', new.id), new.id, null, null);
  end loop;
  return new;
end;
$$;

drop trigger if exists listings_notify_matches on public.listings;
create trigger listings_notify_matches
  after insert on public.listings
  for each row execute function public.listings_notify_matches();

revoke all on function public.interest_categories(text[]) from public, anon, authenticated;
revoke all on function public.neighborhood_center(text) from public, anon, authenticated;
revoke all on function public.listings_notify_matches() from public, anon, authenticated;


-- ─── T-24 / T-25 account deletion redacts by template ───────────────────────
-- 007 replaced the leaving neighbor's *current* name with plain replace():
-- notifications sent under an earlier name kept it (T-24), and other words
-- starting with the first name were mangled ("Annual" → "A former
-- neighborual", T-25).
--
-- Every server notification that names someone names the *other* neighbor
-- in the trade, at the start of the body ("{Name} wants to trade...",
-- "{Name}: message"). So for notifications to others about the leaving
-- neighbor's offers and agreements (or recorded with data.actorId = them,
-- see notify_always), the leading name is replaced by template, whatever
-- name it was sent under. Rows that don't fit a template (older or
-- hand-written ones) fall back to whole-word matches of the current full
-- name and first name. Both are idempotent.

-- The leading "{Name}" of a server notification body → "A former neighbor"
create or replace function public.redact_actor_prefix(p_type text, p_body text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  m text[];
begin
  if p_body is null then
    return null;
  end if;
  if p_type = 'new_message' then
    -- "{First}: {text}" (first_name() is a single word)
    m := regexp_match(p_body, '^(\S+?): ');
  else
    -- 004, 005, 009 and 011 copy
    m := regexp_match(p_body,
      '^(.+?) (wants to trade for your|accepted the trade|suggested a change|declined your offer'
      || '|passed on this trade|withdrew their offer|canceled your trade agreement|flagged your trade'
      || '|marked your trade as done|changed the time and place|signed too|signed the trade agreement'
      || '|left you a review)');
  end if;
  if m is null
     or char_length(m[1]) > 60
     or m[1] in ('A', 'Your', 'A neighbor', 'Your neighbor', 'A former neighbor') then
    return p_body;
  end if;
  return 'A former neighbor' || substr(p_body, char_length(m[1]) + 1);
end;
$$;

-- Whole-word replacement of each name (longest first). Word boundaries are
-- "not a letter, digit or underscore", so names that start or end with
-- punctuation still match; regex metacharacters in names are escaped.
create or replace function public.redact_names(p_text text, p_names text[])
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := p_text;
  n text;
begin
  if v is null then
    return null;
  end if;
  for n in
    select x from (select distinct btrim(x) as x from unnest(coalesce(p_names, '{}')) x) s
     where char_length(x) >= 2
     order by char_length(x) desc, x
  loop
    v := regexp_replace(v,
      '(?<![[:alnum:]_])' || regexp_replace(n, '([^[:alnum:][:space:]_])', '\\\1', 'g') || '(?![[:alnum:]_])',
      'A former neighbor', 'g');
  end loop;
  return v;
end;
$$;

-- 007's delete_account() with a new step 4; steps 1–3, 5 and 6 unchanged.
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

  -- 4. Take their name out of notifications other neighbors got about them:
  --    by template first (any name they ever used), then whole words of the
  --    current name for anything that doesn't fit a template.
  update public.notifications n
     set title = public.redact_names(n.title, array[v_name, v_first]),
         body  = public.redact_names(public.redact_actor_prefix(n.type, n.body), array[v_name, v_first])
   where n.user_id <> p_user_id
     and (n.offer_id in (select o.id from public.offers o
                          where o.from_user_id = p_user_id or o.to_user_id = p_user_id)
          or n.agreement_id in (select a.id from public.agreements a
                                 where a.party_a_user_id = p_user_id or a.party_b_user_id = p_user_id)
          or n.data ->> 'actorId' = p_user_id);

  -- 5. Private data that only this person could see.
  delete from public.notifications where user_id = p_user_id;
  delete from public.push_subscriptions where user_id = p_user_id;

  -- 6. The sign-in identity (email, password, Google or Apple link).
  delete from auth.users where id = p_user_id::uuid;
end;
$$;

revoke all on function public.redact_actor_prefix(text, text) from public, anon, authenticated;
revoke all on function public.redact_names(text, text[]) from public, anon, authenticated;
revoke all on function public.delete_account(text) from public, anon, authenticated;

-- Backfill: neighbors who already deleted their account under 007 may have
-- left earlier names in other neighbors' notifications. Their old names are
-- gone, but the template rewrite needs none. (Words 007 already mangled,
-- like "A former neighborual", can't be restored: the original text is
-- lost.)
update public.notifications n
   set body = public.redact_actor_prefix(n.type, n.body)
  from public.users u
 where u.display_name = 'Former neighbor'
   and u.username ~ '^former_[0-9a-f]{12}$'
   and n.user_id <> u.id
   and (n.offer_id in (select o.id from public.offers o where u.id in (o.from_user_id, o.to_user_id))
        or n.agreement_id in (select a.id from public.agreements a where u.id in (a.party_a_user_id, a.party_b_user_id)))
   and n.body is distinct from public.redact_actor_prefix(n.type, n.body);


-- ─── T-26 notification_prefs is private ─────────────────────────────────────
-- 001's "Public read users" policy plus Supabase's default table grant let
-- anyone, signed out included, read every neighbor's notification settings.
-- Column grants: every other column stays public (profiles, reputation,
-- late_cancellations, the reliability metric shown on profiles);
-- notification_prefs is readable only by the service role, and by its
-- owner through my_notification_prefs().
--
-- Note for the app: `select('*')` on users now fails with "permission
-- denied for table users"; queries must list their columns. A column added
-- to users later is private until it is granted here.

revoke select on public.users from anon, authenticated;
grant select (id, username, display_name, avatar_url, bio, neighborhood, interests,
              reputation_score, trade_count, joined_at, late_cancellations)
  on public.users to anon, authenticated;
grant select on public.users to service_role;

create or replace function public.my_notification_prefs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid text := auth.uid()::text;
  v_prefs jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in to see your notification settings' using errcode = '42501';
  end if;
  select coalesce(notification_prefs, '{}'::jsonb) into v_prefs from public.users where id = v_uid;
  return v_prefs;
end;
$$;

revoke all on function public.my_notification_prefs() from public, anon;
grant execute on function public.my_notification_prefs() to authenticated;
