-- ════════════════════════════════════════════════════════════════════════════
-- 009 — Trade agreement lifecycle: time and place, cancel, flag for review
--
--  1. Exchange details (method, date and time, place, notes) are edited on
--     the agreement while it's being agreed. 004's agreements_guard already
--     clears BOTH signatures whenever any of them changes and refuses changes
--     once both neighbors signed; this migration adds:
--       • exchange_date must be an ISO timestamp in the future, stored as
--         UTC ("2026-11-02T20:00:00.000Z", same shape as JS toISOString)
--       • place and notes are trimmed; blank becomes null
--       • signing needs a method, a date and time, and a place, so nobody
--         locks an agreement with no way to add them afterwards
--       • who changed the details last, and when (terms_updated_by/_at)
--  2. Cancel: who and when are stamped server-side. A cancellation counts
--     as late when the agreement was active (both signed, so the swap time
--     was agreed) and it happens less than 24 hours before the exchange time,
--     or after it. late_cancellations on the canceling neighbor's profile
--     goes up by one. Computed here from now() and the stored exchange time,
--     never taken from the client. Reopening stays impossible (004 + 006).
--  3. Flag for review (status 'disputed'): needs a short reason (1–500
--     characters). Who, when and why are stored. Flagging never touches
--     trade_count or reputation_score (agreements_after_complete only fires
--     on a change to 'completed'; reviews_after_insert only on new reviews).
--  4. The other neighbor is notified of detail changes, cancellations and
--     flags (type 'agreement_ready', which links to the agreement).
--
-- Like 004, every client guard keys off auth.uid(): when it is null the
-- statement comes from a trusted context (service role, SQL editor,
-- delete_account) and the client rules are skipped.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── Columns ────────────────────────────────────────────────────────────────

alter table public.agreements
  add column if not exists terms_updated_at timestamptz,
  add column if not exists terms_updated_by text references public.users(id),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text references public.users(id),
  add column if not exists cancelled_late boolean not null default false,
  add column if not exists disputed_at timestamptz,
  add column if not exists disputed_by text references public.users(id),
  add column if not exists dispute_reason text;

alter table public.agreements
  add constraint agreements_dispute_reason_len
    check (dispute_reason is null or char_length(dispute_reason) between 1 and 500) not valid;

-- Server-maintained, like trade_count: 004's column grants on public.users
-- don't include it, so clients can read it but never write it.
alter table public.users
  add column if not exists late_cancellations integer not null default 0;

-- Operators look up flagged trades by status (see DEPLOY.md)
create index if not exists agreements_disputed_idx
  on public.agreements(disputed_at) where status = 'disputed';


-- ─── Helpers ────────────────────────────────────────────────────────────────

-- exchange_date is text (001). Older rows may hold something that isn't a
-- timestamp; treat those as "no time set" rather than failing.
create or replace function public.agreement_exchange_at(p_value text)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;


-- ─── 1–3. Details, cancel and flag guard ────────────────────────────────────
-- Trigger name sorts before agreements_guard (004), so it runs first:
-- values are normalized before 004 decides whether the terms changed.

create or replace function public.agreements_details_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uid text := auth.uid()::text;
  v_at timestamptz;
begin
  if v_uid is null then
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
    return new;
  end if;

  -- Server-owned columns
  new.terms_updated_at := old.terms_updated_at;
  new.terms_updated_by := old.terms_updated_by;
  new.cancelled_at := old.cancelled_at;
  new.cancelled_by := old.cancelled_by;
  new.cancelled_late := old.cancelled_late;
  new.disputed_at := old.disputed_at;
  new.disputed_by := old.disputed_by;

  -- Exchange details: normalize, then validate what changed
  new.exchange_location := nullif(btrim(new.exchange_location), '');
  new.special_instructions := nullif(btrim(new.special_instructions), '');
  new.exchange_date := nullif(btrim(new.exchange_date), '');

  if new.exchange_date is distinct from old.exchange_date and new.exchange_date is not null then
    v_at := public.agreement_exchange_at(new.exchange_date);
    if v_at is null then
      raise exception 'Pick a date and time for the swap' using errcode = 'P0001';
    end if;
    if v_at <= now() then
      raise exception 'Pick a time that hasn''t happened yet' using errcode = 'P0001';
    end if;
    new.exchange_date := to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  end if;

  if new.exchange_method is distinct from old.exchange_method
     or new.exchange_date is distinct from old.exchange_date
     or new.exchange_location is distinct from old.exchange_location
     or new.special_instructions is distinct from old.special_instructions then
    new.terms_updated_at := now();
    new.terms_updated_by := v_uid;
  end if;

  -- Signing needs a time and place to sign to
  if ((new.party_a_signed and not old.party_a_signed) or (new.party_b_signed and not old.party_b_signed))
     and (new.exchange_method is null or new.exchange_date is null or new.exchange_location is null) then
    raise exception 'Add how, when and where you''ll swap before signing' using errcode = 'P0001';
  end if;

  -- Flag for review: a reason is required, and only set with the flag
  if new.status = 'disputed' and old.status is distinct from 'disputed' then
    new.dispute_reason := nullif(btrim(new.dispute_reason), '');
    if new.dispute_reason is null then
      raise exception 'Say briefly what went wrong' using errcode = 'P0001';
    end if;
    if char_length(new.dispute_reason) > 500 then
      raise exception 'Keep the reason to 500 characters or fewer' using errcode = 'P0001';
    end if;
    new.disputed_at := now();
    new.disputed_by := v_uid;
  else
    new.dispute_reason := old.dispute_reason;
  end if;

  -- Cancel: late if the swap was agreed and is less than 24 hours away (or past)
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_at := public.agreement_exchange_at(old.exchange_date);
    new.cancelled_at := now();
    new.cancelled_by := v_uid;
    new.cancelled_late := old.status = 'active'
      and v_at is not null
      and now() > v_at - interval '24 hours';
  end if;

  return new;
end;
$$;

drop trigger if exists agreements_details_guard on public.agreements;
create trigger agreements_details_guard
  before update on public.agreements
  for each row execute function public.agreements_details_guard();


-- ─── Late cancellations on the profile ──────────────────────────────────────

create or replace function public.agreements_after_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and new.cancelled_late
     and new.cancelled_by is not null then
    update public.users
      set late_cancellations = coalesce(late_cancellations, 0) + 1
      where id = new.cancelled_by;
  end if;
  return new;
end;
$$;

drop trigger if exists agreements_after_cancel on public.agreements;
create trigger agreements_after_cancel
  after update on public.agreements
  for each row execute function public.agreements_after_cancel();


-- ─── 4. Notifications ───────────────────────────────────────────────────────
-- 005's notify_agreement_change, plus detail changes, cancel and flag.

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
      perform public.notify(p, 'agreement_ready', 'Trade canceled',
        'This trade agreement was canceled. Nothing more to do here.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id)
      from unnest(array[new.party_a_user_id, new.party_b_user_id]) as p;
    else
      perform public.notify(v_other, 'agreement_ready', 'Trade canceled',
        v_name || ' canceled your trade agreement. Message them if you want to try again.',
        jsonb_build_object('agreementId', new.id), null, new.offer_id, new.id);
    end if;
  elsif new.status = 'disputed' and old.status is distinct from 'disputed' then
    if v_actor is not null then
      perform public.notify(v_other, 'agreement_ready', 'Trade flagged for review',
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


-- Trigger functions are only ever invoked by triggers. agreement_exchange_at
-- keeps its default grant: agreements_details_guard runs as the caller and
-- calls it, and it only parses a string.
revoke all on function public.agreements_details_guard() from public, anon, authenticated;
revoke all on function public.agreements_after_cancel() from public, anon, authenticated;
revoke all on function public.notify_agreement_change() from public, anon, authenticated;
