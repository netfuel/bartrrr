-- Listings: coarse coordinates (L-07), 30-day expiry and renewal (L-08),
-- match notifications (L-10).

-- ─── L-07 coordinates are rounded to ~1 km ──────────────────────────────────
select tests.as('ann');
select tests.ok('L-07', 'Ann posts a listing with exact coordinates',
  $$insert into public.listings (id, title, description, category, seeking, user_id, neighborhood, lat, lng)
    values ('L-ann-1', 'Box fan', 'Works fine', 'goods', 'houseplants',
            'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young', 35.118734, -89.987216)$$);
select tests.check('L-07', 'stored at 2 decimal places (35.12, -89.99)',
  (select lat = 35.12 and lng = -89.99 from public.listings where id = 'L-ann-1'),
  (select format('stored %s, %s', lat, lng) from public.listings where id = 'L-ann-1'));
select tests.ok('L-07', 'Ann moves the pin',
  $$update public.listings set lat = 35.144901, lng = -89.995123 where id = 'L-ann-1'$$);
select tests.check('L-07', 'updated coordinates are rounded too (35.14, -90.00)',
  (select lat = 35.14 and lng = -90.00 from public.listings where id = 'L-ann-1'),
  (select format('stored %s, %s', lat, lng) from public.listings where id = 'L-ann-1'));
select tests.check('L-07', 'neighbors read only the rounded value',
  (select count(*) = 1 from public.listings where id = 'L-ann-1' and lat::text = '35.14'));

select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood, lat, lng)
values ('L-bob-svc', 'Seeded rake', 'From the operator', 'outdoor', 'anything',
        'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown', 35.1499999, -90.0050001);
select tests.check('L-07', 'rounded even when written by the server (35.15, -90.01)',
  (select lat = 35.15 and lng = -90.01 from public.listings where id = 'L-bob-svc'),
  (select format('stored %s, %s', lat, lng) from public.listings where id = 'L-bob-svc'));
select tests.check('L-07', 'no listing anywhere holds more than 2 decimal places',
  (select bool_and(lat = round(lat, 2) and lng = round(lng, 2)) from public.listings where lat is not null));

-- ─── L-08 30-day expiry and renewal ─────────────────────────────────────────
select tests.as('ann');
select tests.ok('L-08', 'Ann posts with a forged status, dates and expiry',
  $$insert into public.listings (id, title, description, category, seeking, user_id, neighborhood,
                                 status, created_at, expires_at)
    values ('L-ann-2', 'Bread maker', 'Used twice', 'goods', 'gardening help',
            'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young',
            'completed', '2020-01-01', '2099-01-01')$$);
select tests.check('L-08', 'server sets status active and expiry to 30 days from now',
  (select status = 'active' and tests.near(expires_at, now() + interval '30 days')
          and tests.near(created_at, now()) from public.listings where id = 'L-ann-2'),
  (select format('status %s, expires %s, created %s', status, expires_at, created_at) from public.listings where id = 'L-ann-2'));

create temp table l08_before as select expires_at from public.listings where id = 'L-ann-2';
grant select on l08_before to authenticated;
select tests.ok('L-08', 'Ann tries to push her expiry out a year',
  $$update public.listings set expires_at = now() + interval '365 days' where id = 'L-ann-2'$$);
select tests.check('L-08', 'expiry unchanged (clients can''t set it)',
  (select l.expires_at = b.expires_at from public.listings l, l08_before b where l.id = 'L-ann-2'));
select tests.ok('L-08', 'Ann edits the title of an active listing',
  $$update public.listings set title = 'Bread machine' where id = 'L-ann-2'$$);
select tests.check('L-08', 'an ordinary edit doesn''t renew',
  (select l.expires_at = b.expires_at from public.listings l, l08_before b where l.id = 'L-ann-2'));

-- 30 days pass (time override: move the stored expiry into the past)
select tests.as('trusted');
update public.listings set expires_at = now() - interval '1 hour' where id = 'L-ann-2';

select tests.as('bob');
select tests.err('L-08', 'no offers on an expired listing',
  $$select public.make_offer('o-l08-1', 'L-ann-2', 'm-l08-1', 'Swap?', array['Tomato starts'])$$,
  'row-level security');
select tests.no_effect('L-08', 'Bob can''t renew Ann''s listing',
  $$update public.listings set status = 'active' where id = 'L-ann-2'$$);

select tests.as('ann');
select tests.ok('L-08', 'Ann renews her expired listing',
  $$update public.listings set status = 'active' where id = 'L-ann-2'$$);
select tests.check('L-08', 'renewal restarts the 30 days',
  (select status = 'active' and tests.near(expires_at, now() + interval '30 days') from public.listings where id = 'L-ann-2'));
select tests.as('bob');
select tests.ok('L-08', 'renewed listing takes offers again',
  $$select public.make_offer('o-l08-2', 'L-ann-2', 'm-l08-2', 'Swap?', array['Tomato starts'])$$);

-- Take down and relist
select tests.as('trusted');
update public.listings set expires_at = now() + interval '2 days' where id = 'L-ann-1';
select tests.as('ann');
select tests.ok('L-08', 'Ann takes a listing down',
  $$update public.listings set status = 'withdrawn' where id = 'L-ann-1'$$);
select tests.check('L-08', 'taking down keeps the old expiry',
  (select tests.near(expires_at, now() + interval '2 days') from public.listings where id = 'L-ann-1'));
select tests.ok('L-08', 'Ann relists it',
  $$update public.listings set status = 'active' where id = 'L-ann-1'$$);
select tests.check('L-08', 'relisting restarts the 30 days',
  (select tests.near(expires_at, now() + interval '30 days') from public.listings where id = 'L-ann-1'));
select tests.no_effect('L-08', 'listings can''t be hard-deleted by their owner (take down instead)',
  $$delete from public.listings where id = 'L-ann-1'$$);
select tests.as('bob');
select tests.no_effect('L-08', 'Bob can''t take down Ann''s listing',
  $$update public.listings set status = 'withdrawn' where id = 'L-ann-1'$$);

-- ─── L-10 match notifications ───────────────────────────────────────────────
-- The app's rule (CreateListingPage): neighbors other than the poster whose
-- interests include the new listing's category get a 'match' notification.
-- Server side (012): onboarding's finer interest ids map to categories,
-- recipients are nearby (same neighborhood or within 5 mi), at most 50 per
-- listing and one per neighbor per hour, and perfectMatches is honored.
select tests.as('cat');
update public.users set interests = array['goods', 'outdoor'] where id = tests.uid('cat');
select tests.as('dan');
update public.users set interests = array['services'] where id = tests.uid('dan');
select tests.as('ann');
update public.users set interests = array['goods'] where id = tests.uid('ann');
-- Onboarding stores finer interest ids (OnboardingPage INTEREST_CATEGORIES);
-- 'household' is a kind of goods
select tests.as('bob');
update public.users set interests = array['household', 'tutoring'] where id = tests.uid('bob');
select tests.as('ann');

select tests.ok('L-10', 'Ann posts a goods listing',
  $$insert into public.listings (id, title, description, category, seeking, user_id, neighborhood)
    values ('L-ann-3', 'Camp stove', 'Two burners', 'goods', 'bike tune-up',
            'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young')$$);

select tests.as('cat');
select tests.check('L-10', 'Cat (interested in goods) gets a match notification',
  exists (select 1 from public.notifications where type = 'match' and listing_id = 'L-ann-3'));
select tests.as('dan');
select tests.check('L-10', 'Dan (interested in services only) gets none',
  not exists (select 1 from public.notifications where type = 'match' and listing_id = 'L-ann-3'));
select tests.as('ann');
select tests.check('L-10', 'the poster gets none, even though her interests match',
  not exists (select 1 from public.notifications where type = 'match' and listing_id = 'L-ann-3'));
select tests.err('L-10', 'a client can''t create the match notification for someone else',
  $$insert into public.notifications (user_id, type, title, body, listing_id)
    values ('cccccccc-0000-0000-0000-000000000003', 'match', 'New listing you might like', 'x', 'L-ann-3')$$,
  'permission denied');

-- Onboarding vocabulary and copy (docs/content-style-guide.md §9)
select tests.as('bob');
select tests.check('L-10', 'Bob (onboarding interest "household", Midtown) gets a match for a goods listing',
  exists (select 1 from public.notifications where type = 'match' and listing_id = 'L-ann-3'));
select tests.check('L-10', 'match copy: "New listing you might like" / A neighbor just posted "Camp stove"...',
  exists (select 1 from public.notifications where type = 'match' and listing_id = 'L-ann-3'
            and title = 'New listing you might like'
            and body = 'A neighbor just posted "Camp stove". It matches what you''re looking for.'
            and data->>'listingId' = 'L-ann-3'),
  (select string_agg(title || ' / ' || body, '; ') from public.notifications where type = 'match'));

-- At most one match notification per neighbor per hour
select tests.as('ann');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood)
values ('L-ann-4', 'Kettle', 'Electric', 'goods', 'anything', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young');
select tests.as('cat');
select tests.check('L-10', 'a second listing within the hour sends Cat nothing more',
  (select count(*) = 1 from public.notifications where type = 'match'));

-- An hour later: Bob turned matches off, Dan moved far away
select tests.as('trusted');
update public.notifications set created_at = now() - interval '2 hours' where type = 'match';
select tests.as('bob');
update public.users set notification_prefs = '{"perfectMatches":false}' where id = tests.uid('bob');
select tests.as('dan');
update public.users set interests = array['goods'], neighborhood = 'Collierville' where id = tests.uid('dan');
select tests.as('ann');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood)
values ('L-ann-5', 'Toaster', 'Four slots', 'goods', 'anything', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young');
select tests.as('cat');
select tests.check('L-10', 'an hour later Cat gets the next match',
  exists (select 1 from public.notifications where type = 'match' and listing_id = 'L-ann-5'));
select tests.as('bob');
select tests.check('L-10', 'perfectMatches off: Bob gets none',
  not exists (select 1 from public.notifications where type = 'match' and listing_id = 'L-ann-5'));
select tests.as('dan');
select tests.check('L-10', 'Dan (goods, but in Collierville, ~20 mi away) gets none',
  not exists (select 1 from public.notifications where type = 'match'));

-- A taken-down listing posted by the operator notifies nobody
select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood, status)
values ('L-ann-off', 'Old radio', 'd', 'goods', 'x', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young', 'withdrawn');
select tests.check('L-10', 'no matches for a listing that isn''t active',
  not exists (select 1 from public.notifications where listing_id = 'L-ann-off'));

-- At most 50 neighbors per listing
insert into auth.users (id, email, raw_user_meta_data)
select ('eeeeeeee-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'n' || g || '@example.com',
       jsonb_build_object('full_name', 'Neighbor ' || g)
  from generate_series(1, 60) g;
update public.users set interests = array['furniture'], neighborhood = 'Cooper-Young'
 where id like 'eeeeeeee-%';
select tests.as('cat');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood)
values ('L-cat-1', 'Armchair', 'Green', 'goods', 'anything', 'cccccccc-0000-0000-0000-000000000003', 'Binghampton');
select tests.as('trusted');
select tests.check('L-10', 'one listing notifies at most 50 neighbors',
  (select count(*) = 50 from public.notifications where type = 'match' and listing_id = 'L-cat-1'),
  (select count(*) || ' match notifications' from public.notifications where type = 'match' and listing_id = 'L-cat-1'));
