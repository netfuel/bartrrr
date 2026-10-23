-- ════════════════════════════════════════════════════════════════════════════
-- 006 — Close agreement status loopholes left by 004
--
-- 004's agreements_guard() lets a party set status = 'active' from any state.
-- The both-signatures check only runs when the old status is a pending one,
-- so 'cancelled' → 'active' skipped signing, and
-- 'disputed' → 'active' → 'completed' could repeat, adding to both parties'
-- trade_count every time.
--
-- Rules after this migration (client requests only; trusted contexts with
-- auth.uid() null are unchanged):
--   • 'active' is reachable only from draft / under_review / pending_signatures
--     (and agreements_guard still requires both signatures for that)
--   • a trade counts toward trade_count once, the first time it completes
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.agreements_status_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.status = 'active'
     and old.status is distinct from 'active'
     and old.status not in ('draft', 'under_review', 'pending_signatures') then
    raise exception 'This agreement can''t be reopened' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Fires after agreements_guard (same timing, triggers run in name order)
drop trigger if exists agreements_status_guard on public.agreements;
create trigger agreements_status_guard
  before update on public.agreements
  for each row execute function public.agreements_status_guard();

create or replace function public.agreements_after_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed'
     and old.completed_at is null then
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

revoke all on function public.agreements_status_guard() from public, anon, authenticated;
revoke all on function public.agreements_after_complete() from public, anon, authenticated;
