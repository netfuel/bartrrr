-- ════════════════════════════════════════════════════════════════════════════
-- 011 — Tell the listing owner when an offer is withdrawn
--
-- 005's notify_offer_change() had no case for 'withdrawn', so the other
-- neighbor only found out on their next load (or by push, if subscribed).
-- Same function as 005 plus one branch. It fires only when the offer's maker
-- withdraws it themselves: withdrawals done by account deletion (007, no
-- auth.uid()) keep their own wording.
-- ════════════════════════════════════════════════════════════════════════════

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
    perform public.notify(new.to_user_id, 'offer_declined', 'Offer withdrawn',
      coalesce(nullif(public.first_name(v_actor), ''), 'Your neighbor')
        || ' withdrew their offer on your ' || coalesce(v_listing_title, 'listing') || '.',
      jsonb_build_object('offerId', new.id), new.listing_id, new.id, null);
  end if;
  -- 'declined' is announced by notify_offer_message(), which has the reason
  return new;
end;
$$;
