-- P-06 notification preferences (Settings → Notifications) are respected by
-- the server's notify() path. Keys and labels (SettingsPage.tsx):
--   newOffers         New offers and counter-offers
--   messages          Messages from neighbors
--   agreementUpdates  Trade agreements to sign
--   tradeCompletions  Completed trades and reviews
--   perfectMatches    New listings that match what you want (see L-10)
-- A missing key means on (001's default and the client's mapping).

select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood) values
  ('LA', 'Stand mixer',  'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young'),
  ('LB', 'Leaf blower',  'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown'),
  ('LC', 'Bookcase',     'd', 'goods', 'help', 'cccccccc-0000-0000-0000-000000000003', 'Binghampton'),
  ('LD', 'Snowboard',    'd', 'goods', 'help', 'dddddddd-0000-0000-0000-000000000004', 'Crosstown');

-- Bob turns everything off; Cat keeps the defaults; Dan's prefs are empty
select tests.as('bob');
select tests.ok('P-06', 'Bob turns all notifications off in Settings',
  $$update public.users set notification_prefs =
      '{"newOffers":false,"messages":false,"agreementUpdates":false,"tradeCompletions":false,"perfectMatches":false}'
    where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$);
select tests.as('ann');
select tests.no_effect('P-06', 'Ann can''t change Bob''s preferences',
  $$update public.users set notification_prefs = '{}' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$);
select tests.as('trusted');
update public.users set notification_prefs = '{}' where id = tests.uid('dan');

-- Activity aimed at each of them
select tests.as('ann');
select public.make_offer('o-ab', 'LB', 'm-ab', 'Mixer for the blower?', array['Hand mixer']);
select public.make_offer('o-ac', 'LC', 'm-ac', 'For the bookcase?', array['Lamp']);
select public.make_offer('o-ad', 'LD', 'm-ad', 'For the snowboard?', array['Skis']);
select tests.as('bob');
select public.make_offer('o-ba', 'LA', 'm-ba', 'Blower for the mixer?', array['Leaf blower']);
select tests.as('ann');
select public.respond_to_offer('o-ba', 'counter', 'm-ba-2', 'Add the rake?', array['Leaf blower', 'Rake']);
insert into public.offer_messages (offer_id, from_user_id, type, content)
values ('o-ba', tests.uid('ann'), 'message', 'The rake is the green one');
select tests.as('bob');
select public.respond_to_offer('o-ba', 'accept', 'm-ba-3', 'Deal', '{}');
select tests.as('ann');
update public.agreements set exchange_method = 'in_person', exchange_date = tests.iso(now() + interval '2 days'),
       exchange_location = 'Overton Park' where id = 'agreement-o-ba';
update public.agreements set party_b_signed = true where id = 'agreement-o-ba';
select tests.as('bob');
update public.agreements set party_a_signed = true where id = 'agreement-o-ba';
select tests.as('ann');
update public.agreements set status = 'completed' where id = 'agreement-o-ba';
insert into public.reviews (agreement_id, reviewer_id, reviewee_id, rating)
values ('agreement-o-ba', tests.uid('ann'), tests.uid('bob'), 5);

-- Controls: the activity does produce notifications for neighbors who want them
select tests.as('cat');
select tests.check('P-06', 'Cat (defaults) gets the new-offer notification',
  exists (select 1 from public.notifications where offer_id = 'o-ac' and type = 'new_offer'));
select tests.as('dan');
select tests.check('P-06', 'Dan (empty prefs = all on) gets the new-offer notification',
  exists (select 1 from public.notifications where offer_id = 'o-ad' and type = 'new_offer'));
select tests.as('ann');
select tests.check('P-06', 'Ann (defaults) got the agreement and completion notices from Bob''s side',
  exists (select 1 from public.notifications where agreement_id = 'agreement-o-ba' and type = 'agreement_ready'));

-- Bob, with everything off
select tests.as('bob');
select tests.check('P-06', 'newOffers off: no new-offer notification',
  not exists (select 1 from public.notifications where offer_id = 'o-ab' and type = 'new_offer'));
select tests.check('P-06', 'newOffers off: no counter-offer notification',
  not exists (select 1 from public.notifications where offer_id = 'o-ba' and type = 'counter_offer'));
select tests.check('P-06', 'messages off: no message notification',
  not exists (select 1 from public.notifications where offer_id = 'o-ba' and type = 'new_message'));
select tests.check('P-06', 'agreementUpdates off: no "details changed" / "your turn to sign" notifications',
  not exists (select 1 from public.notifications where agreement_id = 'agreement-o-ba' and type = 'agreement_ready'));
select tests.check('P-06', 'tradeCompletions off: no trade-complete notification',
  not exists (select 1 from public.notifications where agreement_id = 'agreement-o-ba' and type = 'trade_complete'));
select tests.check('P-06', 'tradeCompletions off: no new-review notification',
  not exists (select 1 from public.notifications where agreement_id = 'agreement-o-ba' and type = 'review_request'));

-- Notices with no setting, and ones that are never skipped: a canceled
-- meetup and a trade flagged for review, even with everything off
select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood) values
  ('LA2', 'Bread pan', 'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young'),
  ('LA3', 'Cake stand', 'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young');
select tests.as('bob');
select public.make_offer('o-ba2', 'LA2', 'm-ba2', 'Blower for the pan?', array['Leaf blower']);
select public.make_offer('o-ba3', 'LA3', 'm-ba3', 'Blower for the stand?', array['Leaf blower']);
select tests.as('ann');
select public.respond_to_offer('o-ba3', 'decline', 'm-ba3-d', 'not_fair', '{}');
select public.respond_to_offer('o-ba2', 'accept', 'm-ba2-a', 'Deal', '{}');
update public.agreements set status = 'cancelled' where id = 'agreement-o-ba2';
update public.agreements set status = 'disputed', dispute_reason = 'Blower was missing its bag'
 where id = 'agreement-o-ba';

select tests.as('bob');
select tests.check('P-06', 'everything off: accepted and declined offers are still announced (no setting for them)',
  exists (select 1 from public.notifications where offer_id = 'o-ba2' and type = 'offer_accepted')
  and exists (select 1 from public.notifications where offer_id = 'o-ba3' and type = 'offer_declined'));
select tests.check('P-06', 'everything off: "Trade canceled" is never skipped',
  exists (select 1 from public.notifications where agreement_id = 'agreement-o-ba2' and title = 'Trade canceled'));
select tests.check('P-06', 'everything off: "Trade flagged for review" is never skipped',
  exists (select 1 from public.notifications where agreement_id = 'agreement-o-ba' and title = 'Trade flagged for review'));
select tests.check('P-06', 'notifications record who caused them (data.actorId), for account deletion',
  (select data->>'actorId' = tests.uid('ann') from public.notifications where offer_id = 'o-ba3' and type = 'offer_declined'));
