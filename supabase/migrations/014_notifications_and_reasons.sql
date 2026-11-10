-- ════════════════════════════════════════════════════════════════════════════
-- 014 — Notification types, decline reason codes, orphaned photo listing
--
--   T-04  canceled / flagged trades and withdrawn offers get their own
--         notification types (trade_canceled, trade_flagged,
--         offer_withdrawn) instead of borrowing agreement_ready and
--         offer_declined; existing rows are backfilled from their titles
--   T-67  a decline stores its reason as a code (offer_messages.
--         decline_reason) and the neighbor's note as the message content;
--         respond_to_offer() takes an optional p_reason
--   T-05  public.orphaned_photo_paths(): listing-photos files no listing or
--         profile uses any more, for scripts/sweep-orphan-photos.mjs
--   PRD 5.7  agreements.party_a_signed_at / party_b_signed_at, stamped by
--         the server when a signature is given, cleared when it's cleared
--
-- Redefines functions from 005, 009, 011 and 012 with create or replace
-- (respond_to_offer is dropped and recreated: see T-67); 001–013 are not
-- edited. Safe to run twice: every statement is create or replace, drop ...
-- if exists, add column if not exists, a grant / revoke, or an idempotent
-- update.
--
-- Production notes
--   • Locks: the two `add constraint ... not valid` statements and the
--     `add column`s take a brief ACCESS EXCLUSIVE lock on notifications,
--     offer_messages and agreements (no table rewrite: the new columns are
--     nullable with no default). The backfills and `validate constraint` run on small tables
--     (one row per notification / thread message) and take row locks only.
--     Inserts that fire notifications wait for the migration's transaction;
--     it should finish in well under a second at today's volume.
--   • Backfills: T-04 rewrites notifications.type for rows whose title
--     identifies them (titles are server copy and never carry names, so
--     account-deletion redaction can't have changed them). T-67 only fills
--     the new decline_reason column; message content is left as written.
--   • PostgREST: respond_to_offer gains a parameter and orphaned_photo_paths
--     is new, so the schema cache must reload. Supabase does this on DDL; the
--     `notify pgrst` at the end makes it explicit.
--   • Deploy order: apply 014 before (or with) the front end that sends
--     p_reason. That front end also falls back to the old call if 014 isn't
--     there yet, and the front end from before 014 keeps working after it.
--
-- Supabase grants execute on every new public function to anon and
-- authenticated by default, so each new function below is revoked
-- explicitly unless it is meant to be an RPC.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── T-04 notification types ────────────────────────────────────────────────
-- 009 and 012 sent "Trade canceled" and "Trade flagged for review" as
-- agreement_ready, and 011 sent "Offer withdrawn" as offer_declined, so the
-- app couldn't tell them apart (label, icon, link, settings). New types:
--
--   trade_canceled   "Trade canceled"            (was agreement_ready)
--   trade_flagged    "Trade flagged for review"  (was agreement_ready)
--   offer_withdrawn  "Offer withdrawn"           (was offer_declined)
--
-- Preferences (notification_pref_key, 012): none of the three has a setting.
-- Cancel and flag are still sent through notify_always(), so they are never
-- skipped (012's rule: a meetup that's off or a trade in dispute must not be
-- missed). A withdrawn offer joins accepted / declined / expired: offer
-- outcomes have no setting and are always sent, as before. "Offer expired"
-- keeps offer_declined (not in scope here).
--
-- Constraint first (not valid: rows are checked by `validate` after the
-- backfill, without blocking writes for the scan).

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in ('new_offer', 'counter_offer', 'offer_accepted', 'offer_declined', 'offer_withdrawn',
             'new_message', 'agreement_ready', 'trade_canceled', 'trade_flagged',
             'trade_complete', 'review_request', 'match')
  ) not valid;

-- Same mapping as 012, written out so the three new types are visibly
-- "no setting" rather than forgotten.
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
    -- No setting, always sent: offer_accepted, offer_declined,
    -- offer_withdrawn; trade_canceled and trade_flagged (also sent through
    -- notify_always(), so a future mapping here still couldn't skip them)
    else null
  end;
$$;

-- 012's notify_agreement_change() with the cancel and flag branches on
-- their own types. Every other branch is unchanged.
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
      perform public.notify_always(p, 'trade_canceled', 'Trade canceled',
        'This trade agreement was canceled. Nothing more to do here.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id)
      from unnest(array[new.party_a_user_id, new.party_b_user_id]) as p;
    else
      perform public.notify_always(v_other, 'trade_canceled', 'Trade canceled',
        v_name || ' canceled your trade agreement. Message them if you want to try again.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
    end if;
  elsif new.status = 'disputed' and old.status is distinct from 'disputed' then
    if v_actor is not null then
      perform public.notify_always(v_other, 'trade_flagged', 'Trade flagged for review',
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

-- 011's notify_offer_change() with "Offer withdrawn" on offer_withdrawn.
-- Every other branch is unchanged.
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
    perform public.notify(new.to_user_id, 'new_offer', 'New offer on your listing',
      coalesce(nullif(public.first_name(new.from_user_id), ''), 'A neighbor')
        || ' wants to trade for your ' || coalesce(v_listing_title, 'listing') || '. Take a look.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
    return new;
  end if;

  if new.status is not distinct from old.status and new.round = old.round then
    return new;
  end if;

  v_other := case when v_actor = new.from_user_id then new.to_user_id else new.from_user_id end;

  if new.status = 'accepted' then
    perform public.notify(v_other, 'offer_accepted', 'Offer accepted',
      coalesce(nullif(public.first_name(v_actor), ''), 'Your neighbor')
        || ' accepted the trade. Next: review and sign the trade agreement.',
      jsonb_build_object('offerId', new.id, 'agreementId', 'agreement-' || new.id),
      new.listing_id, new.id, null);
  elsif new.status = 'countered' then
    perform public.notify(v_other, 'counter_offer', 'New counter-offer',
      coalesce(nullif(public.first_name(v_actor), ''), 'Your neighbor')
        || ' suggested a change to your trade. Take a look.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  elsif new.status = 'expired' then
    perform public.notify(new.from_user_id, 'offer_declined', 'Offer expired',
      'Your offer on ' || coalesce(v_listing_title, 'a listing') || ' expired without a reply.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  elsif new.status = 'withdrawn' and v_actor is not null and v_actor = new.from_user_id then
    perform public.notify(new.to_user_id, 'offer_withdrawn', 'Offer withdrawn',
      coalesce(nullif(public.first_name(v_actor), ''), 'Your neighbor')
        || ' withdrew their offer on your ' || coalesce(v_listing_title, 'listing') || '.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  end if;
  -- 'declined' is announced by notify_offer_message(), which has the reason
  return new;
end;
$$;

revoke all on function public.notification_pref_key(text) from public, anon, authenticated;
revoke all on function public.notify_agreement_change() from public, anon, authenticated;
revoke all on function public.notify_offer_change() from public, anon, authenticated;

-- Backfill: every title below has only ever been sent with the old type
-- (009, 011, 012, and the client's demo copy), so title + old type is exact.
update public.notifications set type = 'trade_canceled'
 where type = 'agreement_ready' and title = 'Trade canceled';
update public.notifications set type = 'trade_flagged'
 where type = 'agreement_ready' and title = 'Trade flagged for review';
update public.notifications set type = 'offer_withdrawn'
 where type = 'offer_declined' and title = 'Offer withdrawn';

alter table public.notifications validate constraint notifications_type_check;


-- ─── T-67 decline reasons as codes ──────────────────────────────────────────
-- respond_to_offer() (004/012) took one text field, so the app stored a
-- decline as the reason key alone, or as "<reason label>. <note>" (T-34,
-- src/lib/offers.ts declineContent / parseDecline), and the label text had
-- to be parsed back out. Now:
--
--   offer_messages.decline_reason  the reason code (DECLINE_REASON_LABELS
--                                  keys in src/types/index.ts), only on
--                                  'decline' messages, null for a note-only
--                                  decline
--   offer_messages.content         the neighbor's note; the code itself when
--                                  there is no note (content can't be empty)
--
-- respond_to_offer() gets an optional p_reason. Old callers (the front end
-- from before 014, offers_after_accept's 'accepted_another') still send the
-- reason inside content: a before-insert trigger reads the code out of it
-- (code, label, or "label. note") so every decline gets decline_reason.
-- Content is never rewritten, so the app reads both shapes (parseDecline).

alter table public.offer_messages add column if not exists decline_reason text;

alter table public.offer_messages drop constraint if exists offer_messages_decline_reason_check;
alter table public.offer_messages
  add constraint offer_messages_decline_reason_check check (
    decline_reason is null
    or (type = 'decline'
        and decline_reason in ('not_interested', 'looking_for_specific', 'not_fair',
                               'accepted_another', 'no_longer_available'))
  ) not valid;

-- Reason code → the label the app shows. Same text as DECLINE_REASON_LABELS
-- (src/types/index.ts) and 005's notify_offer_message(). Null for anything else.
create or replace function public.decline_reason_label(p_code text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_code
    when 'not_interested' then 'Not interested in what''s being offered'
    when 'looking_for_specific' then 'I''m looking for something specific: check what my listing asks for'
    when 'not_fair' then 'Offer doesn''t feel like a fair trade'
    when 'accepted_another' then 'I''ve already accepted another offer'
    when 'no_longer_available' then 'It''s no longer available'
  end;
$$;

-- The reason code a stored decline text carries, if any: the code itself,
-- its label, or "<label>. <note>" (the pre-014 shapes). Mirrors the client's
-- parseDecline().
create or replace function public.decline_reason_from_content(p_content text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select c.code
    from unnest(array['not_interested', 'looking_for_specific', 'not_fair',
                      'accepted_another', 'no_longer_available']) as c(code)
   where btrim(p_content) = c.code
      or btrim(p_content) = public.decline_reason_label(c.code)
      or starts_with(btrim(p_content), public.decline_reason_label(c.code) || '. ')
   limit 1;
$$;

-- The note part of a decline: null when the content is only the reason
-- (code or label), the text after "<label>. " for the old combined shape,
-- otherwise the trimmed content.
create or replace function public.decline_note(p_code text, p_content text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_code is not null and (btrim(p_content) = p_code
                                 or btrim(p_content) = public.decline_reason_label(p_code))
      then null
    when p_code is not null and starts_with(btrim(p_content), public.decline_reason_label(p_code) || '. ')
      then nullif(btrim(substr(btrim(p_content), char_length(public.decline_reason_label(p_code)) + 3)), '')
    else nullif(btrim(p_content), '')
  end;
$$;

-- Before insert: fill decline_reason from content when the caller didn't
-- set it (old front end, offers_after_accept, trusted inserts). Security
-- definer only so that neighbors' inserts (respond_to_offer runs as the
-- caller) can use the helpers above, which stay private.
create or replace function public.offer_messages_decline_reason()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.type = 'decline' and new.decline_reason is null then
    new.decline_reason := public.decline_reason_from_content(new.content);
  end if;
  return new;
end;
$$;

drop trigger if exists offer_messages_decline_reason on public.offer_messages;
create trigger offer_messages_decline_reason
  before insert on public.offer_messages
  for each row execute function public.offer_messages_decline_reason();

-- respond_to_offer: 012's body plus p_reason. A new parameter can't be
-- added with create or replace, and keeping the 5-argument version beside a
-- 6-argument one would make PostgREST's overload choice ambiguous for calls
-- that leave out p_items/p_reason (PGRST203). So the old one is dropped and
-- the new one gives p_reason a default: every existing call (the 5 named
-- arguments the app sends, or 4 without p_items) still resolves to it.
-- Dropped and recreated in this transaction, so callers never see it missing.
drop function if exists public.respond_to_offer(text, text, text, text, text[]);

create or replace function public.respond_to_offer(
  p_offer_id text,
  p_action text,
  p_message_id text,
  p_content text,
  p_items text[] default '{}',
  p_reason text default null
) returns public.offers
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid text := auth.uid()::text;
  v_status text;
  v_content text := p_content;
  o public.offers;
begin
  if v_uid is null then
    raise exception 'Sign in to respond to offers' using errcode = '42501';
  end if;

  if p_action = 'decline' and p_reason is not null then
    -- Same codes as decline_reason_label() (private, so spelled out here)
    if p_reason not in ('not_interested', 'looking_for_specific', 'not_fair',
                        'accepted_another', 'no_longer_available') then
      raise exception 'Pick one of the decline reasons' using errcode = 'P0001';
    end if;
    -- No note: store the code, like the pre-014 app did
    v_content := coalesce(nullif(btrim(p_content), ''), p_reason);
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
    insert into public.offer_messages (id, offer_id, from_user_id, type, content, items, decline_reason)
    values (
      coalesce(p_message_id, 'msg-' || replace(gen_random_uuid()::text, '-', '')),
      o.id, v_uid, p_action, v_content,
      case when p_action = 'counter' then p_items else '{}'::text[] end,
      case when p_action = 'decline' then p_reason end
    );
    perform set_config('bartrrr.offer_rpc', '', true);
  end if;

  return o;
end;
$$;

-- 005's notify_offer_message() with the decline reason read from
-- decline_reason: "<label>" or "<label>. <note>", the same text the old
-- combined content produced, so the notification reads exactly as before.
-- A note-only decline quotes the note. The message branch is unchanged.
create or replace function public.notify_offer_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o public.offers%rowtype;
  v_other text;
  v_name text;
  v_reason text;
begin
  if new.type not in ('message', 'decline') then
    return new;
  end if;
  select * into o from public.offers where id = new.offer_id;
  if not found then
    return new;
  end if;
  v_other := case when new.from_user_id = o.from_user_id then o.to_user_id else o.from_user_id end;

  if new.type = 'decline' then
    v_name := coalesce(nullif(public.first_name(new.from_user_id), ''), 'Your neighbor');
    if new.decline_reason is not null then
      v_reason := public.decline_reason_label(new.decline_reason)
        || coalesce('. ' || public.decline_note(new.decline_reason, new.content), '');
    else
      v_reason := nullif(btrim(new.content), '');
    end if;
    perform public.notify(v_other, 'offer_declined', 'Offer declined',
      v_name || ' declined your offer.'
        || coalesce(' Their reason: “' || left(v_reason, 200) || '”', ''),
      jsonb_build_object('offerId', o.id), o.listing_id, o.id, null);
    return new;
  end if;

  perform public.notify(v_other, 'new_message', 'New message',
    coalesce(nullif(public.first_name(new.from_user_id), ''), 'A neighbor') || ': ' || left(new.content, 80),
    jsonb_build_object('offerId', o.id), o.listing_id, o.id, null);
  return new;
end;
$$;

revoke all on function public.decline_reason_label(text) from public, anon, authenticated;
revoke all on function public.decline_reason_from_content(text) from public, anon, authenticated;
revoke all on function public.decline_note(text, text) from public, anon, authenticated;
revoke all on function public.offer_messages_decline_reason() from public, anon, authenticated;
revoke all on function public.notify_offer_message() from public, anon, authenticated;
revoke all on function public.respond_to_offer(text, text, text, text, text[], text) from public, anon;
grant execute on function public.respond_to_offer(text, text, text, text, text[], text) to authenticated;

-- Backfill: give existing declines their code. Content stays as written.
update public.offer_messages
   set decline_reason = public.decline_reason_from_content(content)
 where type = 'decline'
   and decline_reason is null
   and public.decline_reason_from_content(content) is not null;

alter table public.offer_messages validate constraint offer_messages_decline_reason_check;


-- ─── T-05 orphaned listing photos ───────────────────────────────────────────
-- PhotoPicker and AvatarUploader upload as soon as a photo is picked, before
-- the listing or profile is saved. Closing the tab leaves those files in
-- listing-photos with nothing pointing at them (so do failed cleanups after
-- an edit or an account deletion). SQL can't delete Storage files (Supabase
-- blocks deletes on storage.objects outside the Storage API), so this
-- function only lists them; scripts/sweep-orphan-photos.mjs deletes them
-- through the Storage API with the service role key (DEPLOY.md, "Leftover
-- photos").
--
-- A file is orphaned when it is in listing-photos, older than `older_than`
-- (default 7 days, at least 1 day: an open Create listing page may still
-- post it), and its path appears in no listings.images URL and no
-- users.avatar_url. URLs are matched on the path after "/listing-photos/"
-- (public, signed and render URLs alike; query strings ignored), whatever
-- the host, which errs on the side of keeping files. Paths are
-- <user id>/<uuid>.<ext> (src/lib/photos.ts), so URL encoding doesn't arise.
--
-- Results come in path order, at most max_rows (≤ 1000, PostgREST's default
-- row cap) per call; pass the last path as after_path for the next page.
-- Service role only: it lists every neighbor's files.

create or replace function public.orphaned_photo_paths(
  older_than interval default interval '7 days',
  after_path text default null,
  max_rows integer default 1000
) returns table (path text, created_at timestamptz, bytes bigint)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if older_than is null or older_than < interval '1 day' then
    raise exception 'older_than must be at least 1 day' using errcode = '22023';
  end if;

  return query
    with refs as (
      select substring(u from '/listing-photos/([^?#]+)') as ref
        from public.listings l
       cross join lateral unnest(coalesce(l.images, '{}')) as u
      union
      select substring(us.avatar_url from '/listing-photos/([^?#]+)')
        from public.users us
       where us.avatar_url is not null
    )
    select o.name::text, o.created_at, nullif(o.metadata ->> 'size', '')::bigint
      from storage.objects o
     where o.bucket_id = 'listing-photos'
       and o.created_at < now() - older_than
       and (after_path is null or o.name > after_path)
       and not exists (select 1 from refs r where r.ref = o.name)
     order by o.name
     limit least(greatest(coalesce(max_rows, 1000), 1), 1000);
end;
$$;

revoke all on function public.orphaned_photo_paths(interval, text, integer) from public, anon, authenticated;
grant execute on function public.orphaned_photo_paths(interval, text, integer) to service_role;


-- ─── PRD 5.7 signature timestamps ───────────────────────────────────────────
-- The PRD asks for the time of each party's acknowledgment; agreements only
-- had party_a_signed / party_b_signed. New nullable columns, kept by the
-- server from the flags:
--
--   false → true   *_signed_at := now()
--   true → false   *_signed_at := null (004/009 clear both signatures when
--                  the time, place or items change; the next signature
--                  gets a new time)
--   unchanged      *_signed_at keeps its old value
--
-- Whatever a neighbor writes to these columns is ignored (the table-level
-- update grant can't exclude one column without listing every other one, so
-- the trigger enforces it). A trusted context (SQL editor, service role:
-- no auth.uid()) may set them explicitly, e.g. to correct a record; if it
-- only changes the flags, the same rules apply.
--
-- No backfill: rows signed before 014 keep null (time unknown). Clients read
-- them as "signed, time not recorded".
--
-- The trigger must see the flags after every other before-update trigger
-- has changed them (agreements_details_guard, agreements_guard,
-- agreements_status_guard; same timing fires in name order), hence the
-- "z" in its name.

alter table public.agreements
  add column if not exists party_a_signed_at timestamptz,
  add column if not exists party_b_signed_at timestamptz;

create or replace function public.agreements_signed_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_trusted boolean := auth.uid() is null;
begin
  if tg_op = 'INSERT' then
    if not (v_trusted and new.party_a_signed_at is not null) then
      new.party_a_signed_at := case when new.party_a_signed then now() end;
    end if;
    if not (v_trusted and new.party_b_signed_at is not null) then
      new.party_b_signed_at := case when new.party_b_signed then now() end;
    end if;
    return new;
  end if;

  if not (v_trusted and new.party_a_signed_at is distinct from old.party_a_signed_at) then
    new.party_a_signed_at := case
      when not coalesce(new.party_a_signed, false) then null
      when not coalesce(old.party_a_signed, false) then now()
      else old.party_a_signed_at
    end;
  end if;
  if not (v_trusted and new.party_b_signed_at is distinct from old.party_b_signed_at) then
    new.party_b_signed_at := case
      when not coalesce(new.party_b_signed, false) then null
      when not coalesce(old.party_b_signed, false) then now()
      else old.party_b_signed_at
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists agreements_z_signed_at on public.agreements;
create trigger agreements_z_signed_at
  before insert or update on public.agreements
  for each row execute function public.agreements_signed_at();

revoke all on function public.agreements_signed_at() from public, anon, authenticated;


-- ─── PostgREST ──────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
