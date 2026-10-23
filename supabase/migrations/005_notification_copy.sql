-- ════════════════════════════════════════════════════════════════════════════
-- 005 — Server notification copy matches docs/content-style-guide.md §9
--
-- Recreates the notification trigger functions from 004 with sentence-case
-- titles, no exclamation points, and the same wording the client uses for
-- push notifications. Behavior is unchanged except:
--   • "Offer declined" is now sent from the decline message (which carries
--     the reason) instead of the status change, so the body can include it.
--   • "Trade complete" is only sent the first time a trade is completed.
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
  end if;
  -- 'declined' is announced by notify_offer_message(), which has the reason
  return new;
end;
$$;

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
    -- Reason keys mirror DECLINE_REASON_LABELS in src/types/index.ts;
    -- anything else is the neighbor's own note.
    v_reason := case new.content
      when 'not_interested' then 'Not interested in what''s being offered'
      when 'looking_for_specific' then 'I''m looking for something specific: check what my listing asks for'
      when 'not_fair' then 'Offer doesn''t feel like a fair trade'
      when 'accepted_another' then 'I''ve already accepted another offer'
      when 'no_longer_available' then 'It''s no longer available'
      else nullif(trim(new.content), '')
    end;
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

  -- Creation is announced by the 'offer_accepted' notification
  if new.status = 'completed' and old.status is distinct from 'completed' and old.completed_at is null then
    perform public.notify(v_other, 'trade_complete', 'Trade complete',
      coalesce(nullif(public.first_name(v_actor), ''), 'Your neighbor')
        || ' marked your trade as done. How did it go? Leave a review.',
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

create or replace function public.notify_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.notify(new.reviewee_id, 'review_request', 'New review',
    coalesce(nullif(public.first_name(new.reviewer_id), ''), 'A neighbor') || ' left you a review.',
    jsonb_build_object('agreementId', new.agreement_id), null, null, new.agreement_id);
  return new;
end;
$$;

-- create or replace keeps existing grants, but restate them so this file
-- is safe to read on its own
revoke all on function public.notify_offer_change() from public, anon, authenticated;
revoke all on function public.notify_offer_message() from public, anon, authenticated;
revoke all on function public.notify_agreement_change() from public, anon, authenticated;
revoke all on function public.notify_review() from public, anon, authenticated;
