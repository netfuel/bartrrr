-- Offers: make (F-01), counter (F-02), accept (F-03), decline (F-04),
-- withdraw (F-05), expiry sweep (F-06).

select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood, status) values
  ('LB1', 'Cordless drill',  'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'active'),
  ('LB2', 'Lawn chairs',     'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'active'),
  ('LB3', 'Mountain bike',   'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'active'),
  ('LB4', 'Rice cooker',     'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'active'),
  ('LB5', 'Record player',   'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'active'),
  ('LB6', 'Tent',            'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'active'),
  ('LB7', 'Guitar lessons',  'd', 'services', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'active'),
  ('LB-held', 'Desk',        'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'pending'),
  ('LB-gone', 'Bookshelf',   'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'withdrawn'),
  ('LB-done', 'Lamp',        'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 'completed'),
  ('LA1', 'Sewing machine',  'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young', 'active');

-- ─── F-01 make an offer ─────────────────────────────────────────────────────
select tests.as('ann');
select tests.ok('F-01', 'Ann offers on Bob''s drill',
  $$select public.make_offer('o1', 'LB1', 'm1', 'Fresh bread every week for a month?', array['Sourdough loaf', 'Bagels'])$$);
select tests.check('F-01', 'offer is pending, round 1 of 5, Ann to Bob, 72h clock',
  (select status = 'pending' and round = 1 and max_rounds = 5
          and from_user_id = tests.uid('ann') and to_user_id = tests.uid('bob')
          and last_actor_id = tests.uid('ann')
          and tests.near(expires_at, now() + interval '72 hours')
     from public.offers where id = 'o1'));
select tests.check('F-01', 'thread starts with Ann''s offer message and items',
  (select type = 'offer' and items = array['Sourdough loaf', 'Bagels'] and from_user_id = tests.uid('ann')
     from public.offer_messages where id = 'm1'));
select tests.as('bob');
select tests.check('F-01', 'Bob is notified: "Ann wants to trade for your Cordless drill"',
  exists (select 1 from public.notifications where offer_id = 'o1' and type = 'new_offer'
            and title = 'New offer on your listing'
            and body = 'Ann wants to trade for your Cordless drill. Take a look.'),
  (select string_agg(title || ' / ' || body, '; ') from public.notifications where offer_id = 'o1'));

select tests.as('ann');
select tests.err('F-01', 'no offer on your own listing',
  $$select public.make_offer('o-own', 'LA1', 'm-own', 'x', array['x'])$$, 'row-level security');
select tests.err('F-01', 'no offer on a taken-down listing',
  $$select public.make_offer('o-gone', 'LB-gone', 'm-gone', 'x', array['x'])$$, 'row-level security');
select tests.err('F-01', 'no offer on a listing with a trade in progress',
  $$select public.make_offer('o-held', 'LB-held', 'm-held', 'x', array['x'])$$, 'row-level security');
select tests.err('F-01', 'no offer on a traded listing',
  $$select public.make_offer('o-done', 'LB-done', 'm-done', 'x', array['x'])$$, 'row-level security');
select tests.err('F-01', 'no offer on a listing that doesn''t exist',
  $$select public.make_offer('o-none', 'nope', 'm-none', 'x', array['x'])$$, 'no longer available');
select tests.err('F-01', 'an offer needs at least one item',
  $$select public.make_offer('o-empty', 'LB1', 'm-empty', 'x', '{}')$$, 'at least one thing');
select tests.err('F-01', 'can''t make an offer in someone else''s name',
  $$insert into public.offers (id, listing_id, from_user_id, to_user_id)
    values ('o-forged', 'LB1', 'cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002')$$,
  'row-level security');
select tests.ok('F-01', 'direct insert with forged status, round and expiry',
  $$insert into public.offers (id, listing_id, from_user_id, to_user_id, status, round, expires_at, last_actor_id)
    values ('o-raw', 'LB7', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002',
            'accepted', 4, '2099-01-01', 'bbbbbbbb-0000-0000-0000-000000000002')$$);
select tests.check('F-01', 'server reset it to pending, round 1, 72h, Ann''s turn done',
  (select status = 'pending' and round = 1 and tests.near(expires_at, now() + interval '72 hours')
          and last_actor_id = tests.uid('ann') from public.offers where id = 'o-raw'));
select tests.check('F-01', 'forged accept drafted no agreement',
  not exists (select 1 from public.agreements where offer_id = 'o-raw'));

-- ─── F-02 counter up to round 5, refused after ──────────────────────────────
select tests.as('ann');
select public.make_offer('o2', 'LB2', 'm2-1', 'Two chairs for a hedge trim?', array['Hedge trimming']);
select tests.err('F-02', 'Ann can''t counter her own offer (Bob''s turn)',
  $$select public.respond_to_offer('o2', 'counter', 'm2-x', 'more', array['x'])$$, 'Waiting on the other neighbor');
select tests.as('bob');
select tests.err('F-02', 'a counter needs at least one item',
  $$select public.respond_to_offer('o2', 'counter', 'm2-y', 'hmm', '{}')$$, 'at least one thing');
select tests.as('trusted');
update public.offers set expires_at = now() + interval '1 hour' where id = 'o2';
select tests.as('bob');
select tests.ok('F-02', 'Bob counters (round 2)',
  $$select public.respond_to_offer('o2', 'counter', 'm2-2', 'Add a weeding?', array['Hedge trimming', 'Weeding'])$$);
select tests.check('F-02', 'round 2, countered, clock restarted to 72h, Ann''s turn',
  (select status = 'countered' and round = 2 and last_actor_id = tests.uid('bob')
          and tests.near(expires_at, now() + interval '72 hours') from public.offers where id = 'o2'));
select tests.as('ann');
select tests.check('F-02', 'Ann is notified of the counter',
  exists (select 1 from public.notifications where offer_id = 'o2' and type = 'counter_offer'
            and title = 'New counter-offer' and body like 'Bob suggested a change%'));
select tests.ok('F-02', 'Ann counters (round 3)',
  $$select public.respond_to_offer('o2', 'counter', 'm2-3', 'Just hedges', array['Hedge trimming'])$$);
select tests.as('bob');
select tests.ok('F-02', 'Bob counters (round 4)',
  $$select public.respond_to_offer('o2', 'counter', 'm2-4', 'Hedges and edging', array['Hedge trimming', 'Edging'])$$);
select tests.as('ann');
select tests.ok('F-02', 'Ann counters (round 5)',
  $$select public.respond_to_offer('o2', 'counter', 'm2-5', 'Final: hedges plus edging', array['Hedge trimming', 'Edging'])$$);
select tests.as('bob');
select tests.err('F-02', 'a 6th round is refused',
  $$select public.respond_to_offer('o2', 'counter', 'm2-6', 'One more', array['x'])$$, 'limited to 5 rounds');
select tests.err('F-02', 'skipping rounds with a direct update is refused',
  $$update public.offers set status = 'countered', round = 7 where id = 'o2'$$, 'limited to 5 rounds');
select tests.check('F-02', 'offer still at round 5, no message from the refused counter',
  (select round = 5 and status = 'countered' from public.offers where id = 'o2')
  and not exists (select 1 from public.offer_messages where id in ('m2-6')));
select tests.ok('F-02', 'Bob can still accept at round 5',
  $$select public.respond_to_offer('o2', 'accept', 'm2-a', 'Deal', '{}')$$);
select tests.check('F-02', 'agreement uses the last counter''s items',
  (select party_a_item = 'Hedge trimming, Edging' from public.agreements where offer_id = 'o2'),
  (select 'party_a_item = ' || party_a_item from public.agreements where offer_id = 'o2'));

-- ─── F-03 accept ────────────────────────────────────────────────────────────
select tests.as('cat');
select public.make_offer('o3-cat', 'LB3', 'm3-cat', 'My skateboard?', array['Skateboard']);
select tests.as('ann');
select public.make_offer('o3', 'LB3', 'm3', 'Bread and seedlings?', array['Banana bread', 'Tomato seedlings']);
select tests.err('F-03', 'Ann can''t accept her own offer',
  $$select public.respond_to_offer('o3', 'accept', 'm3-x', 'ok', '{}')$$, 'Waiting on the other neighbor');
select tests.as('cat');
select tests.err('F-03', 'an outsider can''t accept it',
  $$select public.respond_to_offer('o3', 'accept', 'm3-y', 'ok', '{}')$$, 'Offer not found');
select tests.as('bob');
select tests.ok('F-03', 'Bob accepts Ann''s offer',
  $$select public.respond_to_offer('o3', 'accept', 'm3-a', 'Deal!', '{}')$$);
select tests.check('F-03', 'offer accepted, accept message in the thread',
  (select status = 'accepted' from public.offers where id = 'o3')
  and exists (select 1 from public.offer_messages where id = 'm3-a' and type = 'accept'));
select tests.check('F-03', 'agreement drafted: Ann gives the offered items, Bob gives the listing, unsigned',
  (select id = 'agreement-o3' and party_a_user_id = tests.uid('ann') and party_b_user_id = tests.uid('bob')
          and party_a_item = 'Banana bread, Tomato seedlings' and party_b_item = 'Mountain bike'
          and status = 'pending_signatures' and not party_a_signed and not party_b_signed
     from public.agreements where offer_id = 'o3'),
  (select format('%s / %s / %s', id, party_a_item, status) from public.agreements where offer_id = 'o3'));
select tests.check('F-03', 'listing is on hold (pending)',
  (select status = 'pending' from public.listings where id = 'LB3'));
select tests.as('ann');
select tests.check('F-03', 'Ann is told and pointed at the agreement',
  exists (select 1 from public.notifications where offer_id = 'o3' and type = 'offer_accepted'
            and title = 'Offer accepted' and data->>'agreementId' = 'agreement-o3'));
select tests.as('dan');
select tests.err('F-03', 'no new offers while the listing is on hold',
  $$select public.make_offer('o3-dan', 'LB3', 'm3-dan', 'x', array['x'])$$, 'row-level security');

select tests.as('bob');
select tests.expect_bug('accepting needs only the offer to be open, not the listing: a listing already on hold accepts a second offer and drafts a second agreement for the same item');
select tests.err('F-03', 'Bob can''t accept a second offer on the same listing',
  $$select public.respond_to_offer('o3-cat', 'accept', 'm3-cat-a', 'Sure', '{}')$$, '');
select tests.as('trusted');
select tests.expect_bug('see previous check: two agreements exist for one listing');
select tests.check('F-03', 'one listing, one agreement',
  (select count(*) = 1 from public.agreements a join public.offers o on o.id = a.offer_id where o.listing_id = 'LB3'),
  (select count(*) || ' agreements' from public.agreements a join public.offers o on o.id = a.offer_id where o.listing_id = 'LB3'));

-- Cancel before signing: the item should be tradeable again
select tests.as('ann');
select tests.ok('F-03', 'Ann cancels the unsigned agreement',
  $$update public.agreements set status = 'cancelled' where id = 'agreement-o3'$$);
select tests.as('trusted');
update public.agreements set status = 'cancelled' where offer_id = 'o3-cat';  -- the duplicate, if any
select tests.as('bob');
select tests.expect_bug('nothing takes a listing off hold when its agreement is canceled; it stays ''pending'' and the owner''s page only shows "You have a trade in progress"');
select tests.check('F-03', 'canceling the trade puts the listing back up',
  (select status = 'active' from public.listings where id = 'LB3'),
  (select 'listing status ' || status from public.listings where id = 'LB3'));

select tests.as('ann');
select public.make_offer('o3-late', 'LB6', 'm3-late', 'Tent for a tarp?', array['Tarp']);
select tests.as('trusted');
update public.offers set expires_at = now() - interval '1 minute' where id = 'o3-late';
select tests.as('bob');
select tests.err('F-03', 'an offer past its 72 hours can''t be accepted',
  $$select public.respond_to_offer('o3-late', 'accept', 'm3-late-a', 'ok', '{}')$$, 'expired');

-- ─── F-04 decline with a reason ─────────────────────────────────────────────
select tests.as('ann');
select public.make_offer('o4-' || k, 'LB4', 'm4-' || k, 'For your rice cooker?', array['Spice set'])
  from unnest(array['not_interested', 'looking_for_specific', 'not_fair', 'accepted_another',
                    'no_longer_available', 'note', 'blank']) k;
select tests.err('F-04', 'Ann can''t decline her own pending offer',
  $$select public.respond_to_offer('o4-not_fair', 'decline', 'm4-x', 'not_fair', '{}')$$, 'Waiting on the other neighbor');
select tests.as('cat');
select tests.err('F-04', 'an outsider can''t decline it',
  $$select public.respond_to_offer('o4-not_fair', 'decline', 'm4-y', 'not_fair', '{}')$$, 'Offer not found');

select tests.as('bob');
select tests.ok('F-04', 'Bob declines with each reason key',
  $$select public.respond_to_offer('o4-' || k, 'decline', 'm4d-' || k, k, '{}')
      from unnest(array['not_interested', 'looking_for_specific', 'not_fair', 'accepted_another', 'no_longer_available']) k$$);
select tests.ok('F-04', 'Bob declines with his own note',
  $$select public.respond_to_offer('o4-note', 'decline', 'm4d-note', '  Already promised it to my sister  ', '{}')$$);
select tests.check('F-04', 'offers are declined, decline messages in the threads',
  (select bool_and(status = 'declined') from public.offers where id like 'o4-%' and id <> 'o4-blank')
  and (select count(*) = 6 from public.offer_messages where id like 'm4d-%' and type = 'decline'));

select tests.as('ann');
select tests.check('F-04', 'reason keys become the labels the app shows',
  (select count(*) = 5 from public.notifications n
     join (values
       ('o4-not_interested',      'Bob declined your offer. Their reason: “Not interested in what''s being offered”'),
       ('o4-looking_for_specific','Bob declined your offer. Their reason: “I''m looking for something specific: check what my listing asks for”'),
       ('o4-not_fair',            'Bob declined your offer. Their reason: “Offer doesn''t feel like a fair trade”'),
       ('o4-accepted_another',    'Bob declined your offer. Their reason: “I''ve already accepted another offer”'),
       ('o4-no_longer_available', 'Bob declined your offer. Their reason: “It''s no longer available”')
     ) e(offer_id, body) on e.offer_id = n.offer_id and e.body = n.body
    where n.type = 'offer_declined' and n.title = 'Offer declined'),
  (select string_agg(body, ' | ') from public.notifications where offer_id like 'o4-%'));
select tests.check('F-04', 'a free-text note is quoted, trimmed',
  exists (select 1 from public.notifications where offer_id = 'o4-note'
            and body = 'Bob declined your offer. Their reason: “Already promised it to my sister”'));
select tests.check('F-04', 'exactly one notification per decline',
  (select bool_and(c = 1) from (select count(*) c from public.notifications
     where offer_id like 'o4-%' and offer_id <> 'o4-blank' and type = 'offer_declined' group by offer_id) x)
  and (select count(distinct offer_id) = 6 from public.notifications where offer_id like 'o4-%' and type = 'offer_declined'));
select tests.check('F-04', 'Bob is not notified of his own declines',
  not exists (select 1 from public.notifications n where n.offer_id like 'o4-%' and n.user_id = tests.uid('bob') and type = 'offer_declined'));

-- Repeating an answer (double tap, retry after a lost response, or the other side)
select tests.as('bob');
select tests.expect_bug('respond_to_offer: an accept/decline on an offer already in that state passes offers_guard (status unchanged = no-op) and still inserts another thread message, so a repeat decline sends a second "Offer declined" notification');
select tests.err('F-04', 'declining an already-declined offer is refused',
  $$select public.respond_to_offer('o4-not_fair', 'decline', 'm4-z', 'not_fair', '{}')$$, 'already declined');
select tests.as('ann');
select tests.expect_bug('same root cause: the offer maker can post a decline on an offer that was already declined, which notifies the owner "Ann declined your offer"');
select tests.err('F-04', 'the maker can''t post a decline on an offer Bob already declined',
  $$select public.respond_to_offer('o4-note', 'decline', 'm4-z2', 'no_longer_available', '{}')$$, 'already declined');
select tests.expect_bug('same root cause: duplicate decline notifications');
select tests.check('F-04', 'still exactly one decline notification per offer after the repeats',
  (select count(*) = 1 from public.notifications where offer_id = 'o4-not_fair' and type = 'offer_declined')
  and not exists (select 1 from public.notifications where offer_id = 'o4-note' and user_id = tests.uid('bob')),
  (select count(*) || ' notifications on o4-not_fair' from public.notifications where offer_id = 'o4-not_fair'));
select tests.as('ann');
select tests.expect_bug('same root cause: the offer maker can post an "accept" message on her own already-accepted offer');
select tests.err('F-03', 'Ann can''t accept her own offer after Bob accepted it',
  $$select public.respond_to_offer('o2', 'accept', 'm2-dup', 'ok', '{}')$$, 'already accepted');

-- ─── F-05 withdraw ──────────────────────────────────────────────────────────
select tests.as('ann');
select public.make_offer('o5', 'LB5', 'm5', 'For the record player?', array['Vinyl crate']);
select public.make_offer('o5c', 'LB5', 'm5c', 'Or this?', array['Speakers']);
select tests.as('bob');
select public.respond_to_offer('o5c', 'counter', 'm5c-2', 'Speakers and cables', array['Speakers', 'Cables']);
select tests.err('F-05', 'Bob (the listing owner) can''t withdraw Ann''s offer',
  $$select public.respond_to_offer('o5', 'withdraw', null, null, '{}')$$, 'Only the person who made the offer');
select tests.as('cat');
select tests.err('F-05', 'an outsider can''t withdraw it',
  $$select public.respond_to_offer('o5', 'withdraw', null, null, '{}')$$, 'Offer not found');
select tests.as('ann');
select tests.ok('F-05', 'Ann withdraws her pending offer',
  $$select public.respond_to_offer('o5', 'withdraw', null, null, '{}')$$);
select tests.ok('F-05', 'Ann withdraws an offer Bob countered',
  $$select public.respond_to_offer('o5c', 'withdraw', null, null, '{}')$$);
select tests.check('F-05', 'both withdrawn, no message added to the threads',
  (select bool_and(status = 'withdrawn') from public.offers where id in ('o5', 'o5c'))
  and (select count(*) = 3 from public.offer_messages where offer_id in ('o5', 'o5c')));
select tests.ok('F-05', 'withdrawing again (double tap) is harmless',
  $$select public.respond_to_offer('o5', 'withdraw', null, null, '{}')$$);
select tests.err('F-05', 'an accepted offer can''t be withdrawn',
  $$select public.respond_to_offer('o2', 'withdraw', null, null, '{}')$$, 'already accepted');
select tests.err('F-05', 'a declined offer can''t be withdrawn',
  $$select public.respond_to_offer('o4-not_fair', 'withdraw', null, null, '{}')$$, 'already declined');
select tests.check('F-05', 'Ann is not notified of her own withdrawal',
  not exists (select 1 from public.notifications where offer_id in ('o5', 'o5c') and title = 'Offer withdrawn'));
select tests.as('bob');
select tests.check('F-05', 'Bob is told: "Ann withdrew their offer on your Record player."',
  (select count(*) = 2 from public.notifications where offer_id in ('o5', 'o5c') and type = 'offer_declined'
     and title = 'Offer withdrawn' and body = 'Ann withdrew their offer on your Record player.'),
  (select string_agg(title || ': ' || body, ' | ') from public.notifications where offer_id in ('o5', 'o5c')));

-- ─── F-06 expiry sweep (what the pg_cron job runs) ──────────────────────────
-- 004 schedules `select public.expire_stale_offers()` every 15 minutes. The
-- function compares against now(); the time override here is moving each
-- offer's stored expires_at instead.
select tests.as('dan');
select public.make_offer('e1', 'LB6', 'me1', 'x', array['Pending, overdue']);
select public.make_offer('e2', 'LB6', 'me2', 'x', array['Countered, overdue']);
select public.make_offer('e3', 'LB6', 'me3', 'x', array['Pending, not due']);
select public.make_offer('e4', 'LB7', 'me4', 'x', array['Accepted']);
select public.make_offer('e5', 'LB6', 'me5', 'x', array['Declined']);
select tests.as('bob');
select public.respond_to_offer('e2', 'counter', 'me2-b', 'y', array['More']);
select public.respond_to_offer('e4', 'accept', 'me4-b', 'ok', '{}');
select public.respond_to_offer('e5', 'decline', 'me5-b', 'not_fair', '{}');
select tests.as('trusted');
update public.offers set expires_at = now() - interval '1 minute' where id in ('e1', 'e2', 'e4', 'e5');
update public.offers set expires_at = now() + interval '1 hour' where id = 'e3';
-- leave the offers from the other sections out of the count
update public.offers set expires_at = now() + interval '1 hour' where id not like 'e%' and status in ('pending', 'countered');
create temp table f06_before as select id, updated_at from public.offers where id like 'e%';

select tests.check('F-06', 'sweep (as the cron job) expires exactly the 2 overdue open offers',
  (select public.expire_stale_offers() = 2));
select tests.check('F-06', 'pending and countered overdue offers are now expired',
  (select bool_and(status = 'expired') from public.offers where id in ('e1', 'e2')));
select tests.check('F-06', 'not-yet-due, accepted and declined offers untouched',
  (select status from public.offers where id = 'e3') = 'pending'
  and (select status from public.offers where id = 'e4') = 'accepted'
  and (select status from public.offers where id = 'e5') = 'declined');
select tests.check('F-06', 'updated_at stamped on the expired ones',
  (select bool_and(o.updated_at > b.updated_at) from public.offers o join f06_before b using (id) where o.id in ('e1', 'e2')));
select tests.check('F-06', 'the offer maker is told, once per offer',
  (select count(*) = 2 from public.notifications where offer_id in ('e1', 'e2') and user_id = tests.uid('dan')
     and title = 'Offer expired' and body = 'Your offer on Tent expired without a reply.'));
select tests.check('F-06', 'running the sweep again changes nothing',
  (select public.expire_stale_offers() = 0)
  and (select count(*) = 2 from public.notifications where offer_id in ('e1', 'e2') and title = 'Offer expired'));
select tests.as('service_role');
select tests.ok('F-06', 'the service role can run the sweep too',
  $$select public.expire_stale_offers()$$);
select tests.as('bob');
select tests.err('F-06', 'an expired offer can''t be accepted later',
  $$select public.respond_to_offer('e1', 'accept', 'me1-a', 'ok', '{}')$$, 'already expired');
select tests.err('F-06', 'signed-in neighbors can''t run the sweep',
  $$select public.expire_stale_offers()$$, 'permission denied');
