-- U-14 upgrading a database that ran 001–013 to 014: the backfills, and
-- running 014 a second time.
--
-- The template already has 014, so rows "from before 014" are made here the
-- way the old functions wrote them (old notification types; decline messages
-- with no decline_reason), then 014 is applied again on top. That replays
-- both backfills and checks the migration is safe to run twice.

select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood) values
  ('LU1', 'Ladder', 'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown');
insert into public.offers (id, listing_id, from_user_id, to_user_id, status) values
  ('OU1', 'LU1', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'declined'),
  ('OU2', 'LU1', 'cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'declined'),
  ('OU3', 'LU1', 'dddddddd-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'declined'),
  ('OU4', 'LU1', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'declined');

-- Pre-014 notifications (types as 009, 011 and 012 sent them)
insert into public.notifications (id, user_id, type, title, body) values
  ('NU-cancel',   tests.uid('ann'), 'agreement_ready', 'Trade canceled', 'Bob canceled your trade agreement. Message them if you want to try again.'),
  ('NU-flag',     tests.uid('ann'), 'agreement_ready', 'Trade flagged for review', 'Bob flagged your trade: “Broken” Talk it through with them in your messages.'),
  ('NU-withdraw', tests.uid('bob'), 'offer_declined',  'Offer withdrawn', 'Ann withdrew their offer on your Ladder.'),
  ('NU-sign',     tests.uid('ann'), 'agreement_ready', 'Your turn to sign', 'Your neighbor signed the trade agreement.'),
  ('NU-decline',  tests.uid('ann'), 'offer_declined',  'Offer declined', 'Bob declined your offer.'),
  ('NU-expired',  tests.uid('ann'), 'offer_declined',  'Offer expired', 'Your offer on Ladder expired without a reply.');

-- Pre-014 decline messages: the reason lived in content only
alter table public.offer_messages disable trigger offer_messages_decline_reason;
insert into public.offer_messages (id, offer_id, from_user_id, type, content) values
  ('MU-code',   'OU1', tests.uid('bob'), 'decline', 'not_interested'),
  ('MU-label',  'OU2', tests.uid('bob'), 'decline', 'It''s no longer available'),
  ('MU-both',   'OU3', tests.uid('bob'), 'decline', 'Offer doesn''t feel like a fair trade. Maybe add the ropes?'),
  ('MU-note',   'OU4', tests.uid('bob'), 'decline', 'Promised it to my sister');
alter table public.offer_messages enable trigger offer_messages_decline_reason;
select tests.check('U-14', 'setup: the old rows have no decline_reason',
  (select bool_and(decline_reason is null) from public.offer_messages where id like 'MU-%'));

-- Apply 014 again
\ir ../migrations/014_notifications_and_reasons.sql
select tests.as('trusted');

-- ─── T-04 backfill ──────────────────────────────────────────────────────────
select tests.check('U-14', 'T-04 "Trade canceled" agreement_ready → trade_canceled',
  (select type = 'trade_canceled' from public.notifications where id = 'NU-cancel'));
select tests.check('U-14', 'T-04 "Trade flagged for review" agreement_ready → trade_flagged',
  (select type = 'trade_flagged' from public.notifications where id = 'NU-flag'));
select tests.check('U-14', 'T-04 "Offer withdrawn" offer_declined → offer_withdrawn',
  (select type = 'offer_withdrawn' from public.notifications where id = 'NU-withdraw'));
select tests.check('U-14', 'T-04 other notifications keep their type (sign, declined, expired)',
  (select type = 'agreement_ready' from public.notifications where id = 'NU-sign')
  and (select type = 'offer_declined' from public.notifications where id = 'NU-decline')
  and (select type = 'offer_declined' from public.notifications where id = 'NU-expired'));
select tests.check('U-14', 'T-04 titles and bodies untouched by the backfill',
  (select body = 'Bob canceled your trade agreement. Message them if you want to try again.'
     from public.notifications where id = 'NU-cancel'));
select tests.check('U-14', 'T-04 the type constraint is validated',
  (select convalidated from pg_constraint where conname = 'notifications_type_check'
      and conrelid = 'public.notifications'::regclass));

-- ─── T-67 backfill ──────────────────────────────────────────────────────────
select tests.check('U-14', 'T-67 old declines get their code: key, label, or "label. note"',
  (select decline_reason = 'not_interested' from public.offer_messages where id = 'MU-code')
  and (select decline_reason = 'no_longer_available' from public.offer_messages where id = 'MU-label')
  and (select decline_reason = 'not_fair' from public.offer_messages where id = 'MU-both'),
  (select string_agg(id || '=' || coalesce(decline_reason, 'null'), ', ') from public.offer_messages where id like 'MU-%'));
select tests.check('U-14', 'T-67 a note-only decline stays without a code',
  (select decline_reason is null from public.offer_messages where id = 'MU-note'));
select tests.check('U-14', 'T-67 content is left as written',
  (select content = 'Offer doesn''t feel like a fair trade. Maybe add the ropes?' from public.offer_messages where id = 'MU-both'));
select tests.check('U-14', 'T-67 the decline_reason constraint is validated',
  (select convalidated from pg_constraint where conname = 'offer_messages_decline_reason_check'
      and conrelid = 'public.offer_messages'::regclass));
select tests.check('U-14', 'T-67 note helper: "label. note" → note; key or label → nothing; free text → itself',
  public.decline_note('not_fair', 'Offer doesn''t feel like a fair trade. Maybe add the ropes?') = 'Maybe add the ropes?'
  and public.decline_note('not_fair', 'not_fair') is null
  and public.decline_note('not_fair', 'Offer doesn''t feel like a fair trade') is null
  and public.decline_note('not_fair', '  Too low  ') = 'Too low'
  and public.decline_note(null, 'Promised it') = 'Promised it');

-- ─── Running 014 twice ──────────────────────────────────────────────────────
select tests.check('U-14', 'only one respond_to_offer, with p_reason (the 5-argument one is gone)',
  (select array_agg(p.oid::regprocedure::text) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'respond_to_offer')
  = array['respond_to_offer(text,text,text,text,text[],text)']);
select tests.check('U-14', 'after the rerun: respond_to_offer is still for signed-in neighbors only',
  has_function_privilege('authenticated', 'public.respond_to_offer(text,text,text,text,text[],text)', 'execute')
  and not has_function_privilege('anon', 'public.respond_to_offer(text,text,text,text,text[],text)', 'execute'));
select tests.check('U-14', 'after the rerun: orphaned_photo_paths is for the service role only',
  has_function_privilege('service_role', 'public.orphaned_photo_paths(interval,text,integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.orphaned_photo_paths(interval,text,integer)', 'execute')
  and not has_function_privilege('anon', 'public.orphaned_photo_paths(interval,text,integer)', 'execute'));
select tests.check('U-14', 'after the rerun: one decline_reason trigger, one column',
  (select count(*) = 1 from pg_trigger where tgname = 'offer_messages_decline_reason')
  and (select count(*) = 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'offer_messages' and column_name = 'decline_reason'));

select tests.check('U-14', 'after the rerun: one signature-time trigger, both columns, nothing backfilled',
  (select count(*) = 1 from pg_trigger where tgname = 'agreements_z_signed_at')
  and (select count(*) = 2 from information_schema.columns
        where table_schema = 'public' and table_name = 'agreements'
          and column_name in ('party_a_signed_at', 'party_b_signed_at'))
  and not exists (select 1 from public.agreements where party_a_signed_at is not null or party_b_signed_at is not null));
select tests.check('U-14', 'the signature-time trigger runs after every other before-update trigger on agreements',
  (select max(tgname) = 'agreements_z_signed_at' from pg_trigger
    where tgrelid = 'public.agreements'::regclass and not tgisinternal
      and (tgtype & 2) = 2));  -- BEFORE triggers

-- And the app still works on top: a decline with a code after the rerun
select tests.as('ann');
select public.make_offer('OU5', 'LU1', 'MU5', 'For the ladder?', array['Rope']);
select tests.as('bob');
select tests.ok('U-14', 'after the rerun: Bob declines with a code and a note',
  $$select public.respond_to_offer('OU5', 'decline', 'MU5-d', 'Need it this weekend', '{}', 'no_longer_available')$$);
select tests.as('ann');
select tests.check('U-14', 'after the rerun: Ann gets one "Offer declined" with label and note',
  (select count(*) = 1 from public.notifications where offer_id = 'OU5' and type = 'offer_declined'
     and body = 'Bob declined your offer. Their reason: “It''s no longer available. Need it this weekend”'),
  (select string_agg(body, ' | ') from public.notifications where offer_id = 'OU5'));
