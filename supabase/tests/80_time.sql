-- Z-03 time math at the boundaries: late cancellation (24h before the swap),
-- offer and listing expiry, the DST change in America/Chicago, midnight UTC.
--
-- Time override: the app's functions read now(), which Postgres fixes for the
-- whole transaction. Each boundary case sets the stored time relative to
-- now() and acts in the same transaction, so "exactly 24 hours before" is
-- exact. Exchange times are stored to the millisecond (009 normalizes to
-- 2026-11-02T20:00:00.000Z), so "exactly 24h" uses now() rounded up to the
-- next millisecond.

select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood) values
  ('LZ',  'Clock',  'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown'),
  ('LZ1', 'Timer',  'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown'),
  ('LZ2', 'Watch',  'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown');
insert into public.offers (id, listing_id, from_user_id, to_user_id, status)
select 'oz' || g, 'LZ', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'accepted'
  from generate_series(1, 12) g;
-- Active agreements (both signed), one per late-cancel case
insert into public.agreements (id, offer_id, party_a_user_id, party_b_user_id, party_a_item, party_b_item,
                               status, party_a_signed, party_b_signed, exchange_method, exchange_location)
select 'Z' || g, 'oz' || g, 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002',
       'x', 'y', 'active', true, true, 'in_person', 'Library'
  from generate_series(1, 9) g;
-- Pending agreements for exchange-time validation
insert into public.agreements (id, offer_id, party_a_user_id, party_b_user_id, party_a_item, party_b_item, status)
select 'ZP' || g, 'oz' || (9 + g), 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002',
       'x', 'y', 'pending_signatures'
  from generate_series(1, 3) g;

create function tests.ceil_ms(p timestamptz) returns timestamptz language sql immutable as $$
  select date_trunc('milliseconds', p + interval '999 microseconds');
$$;
create function tests.iso_us(p timestamptz) returns text language sql immutable as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$$;
grant execute on function tests.ceil_ms(timestamptz), tests.iso_us(timestamptz) to authenticated, anon;

-- ─── Late cancellation: "less than 24 hours before the swap, or after it" ───
begin;
select tests.as('trusted');
update public.agreements set exchange_date = tests.iso(tests.ceil_ms(now()) + interval '24 hours') where id = 'Z1';
select tests.as('ann');
update public.agreements set status = 'cancelled' where id = 'Z1';
commit;
select tests.as('trusted');
select tests.check('Z-03', 'cancel exactly 24h before the swap is on time',
  (select not cancelled_late from public.agreements where id = 'Z1'));

begin;
select tests.as('trusted');
update public.agreements set exchange_date = tests.iso(date_trunc('milliseconds', now()) + interval '24 hours' - interval '1 millisecond') where id = 'Z2';
select tests.as('ann');
update public.agreements set status = 'cancelled' where id = 'Z2';
commit;
select tests.as('trusted');
select tests.check('Z-03', 'cancel 24h minus 1 ms before the swap is late',
  (select cancelled_late from public.agreements where id = 'Z2'));

begin;
select tests.as('trusted');
update public.agreements set exchange_date = tests.iso(now() + interval '24 hours 1 second') where id = 'Z3';
select tests.as('ann');
update public.agreements set status = 'cancelled' where id = 'Z3';
commit;
select tests.as('trusted');
select tests.check('Z-03', 'cancel 24h + 1 s before the swap is on time',
  (select not cancelled_late from public.agreements where id = 'Z3'));

begin;
select tests.as('trusted');
update public.agreements set exchange_date = tests.iso(date_trunc('milliseconds', now())) where id = 'Z4';
select tests.as('ann');
update public.agreements set status = 'cancelled' where id = 'Z4';
commit;
select tests.as('trusted');
select tests.check('Z-03', 'cancel at the swap time is late',
  (select cancelled_late from public.agreements where id = 'Z4'));

begin;
select tests.as('trusted');
update public.agreements set exchange_date = tests.iso(now() - interval '3 days') where id = 'Z5';
select tests.as('bob');
update public.agreements set status = 'cancelled' where id = 'Z5';
commit;
select tests.as('trusted');
select tests.check('Z-03', 'cancel after the swap time is late (and counts against Bob)',
  (select cancelled_late and cancelled_by = tests.uid('bob') from public.agreements where id = 'Z5'));

begin;
select tests.as('trusted');
update public.agreements set exchange_date = tests.iso(now() + interval '1 hour') where id = 'Z6';
update public.agreements set status = 'cancelled' where id = 'Z6';
commit;
select tests.check('Z-03', 'a cancel by the system (account deletion) is never late',
  (select not cancelled_late and cancelled_at is not null from public.agreements where id = 'Z6'));

-- Same boundaries with the session in Memphis time instead of UTC
begin;
set local timezone = 'America/Chicago';
select tests.as('trusted');
update public.agreements set exchange_date = tests.iso(tests.ceil_ms(now()) + interval '24 hours') where id = 'Z7';
update public.agreements set exchange_date = tests.iso(date_trunc('milliseconds', now()) + interval '24 hours' - interval '1 millisecond') where id = 'Z8';
select tests.as('ann');
update public.agreements set status = 'cancelled' where id in ('Z7', 'Z8');
commit;
select tests.as('trusted');
select tests.check('Z-03', 'session time zone America/Chicago: exactly 24h on time, 1 ms less late',
  (select not cancelled_late from public.agreements where id = 'Z7')
  and (select cancelled_late from public.agreements where id = 'Z8'));

select tests.check('Z-03', 'late counts: Ann 3 (24h-1ms, at swap, Chicago 24h-1ms), Bob 1',
  (select late_cancellations from public.users where id = tests.uid('ann')) = 3
  and (select late_cancellations from public.users where id = tests.uid('bob')) = 1,
  (select format('Ann %s, Bob %s',
     (select late_cancellations from public.users where id = tests.uid('ann')),
     (select late_cancellations from public.users where id = tests.uid('bob')))));

-- ─── DST: Sunday Nov 1 2026, 2:00 CDT → 1:00 CST in Memphis ─────────────────
-- 1:30 AM happened twice that night. The client sends toISOString() (UTC),
-- so the two are different instants an hour apart.
select tests.check('Z-03', 'Nov 1 2026 1:30 AM CDT (-05:00) parses to 06:30Z',
  public.agreement_exchange_at('2026-11-01T01:30:00-05:00') = '2026-11-01 06:30:00+00');
select tests.check('Z-03', 'Nov 1 2026 1:30 AM CST (-06:00) parses to 07:30Z, one hour later',
  public.agreement_exchange_at('2026-11-01T01:30:00-06:00') = '2026-11-01 07:30:00+00'
  and public.agreement_exchange_at('2026-11-01T01:30:00-06:00') - public.agreement_exchange_at('2026-11-01T01:30:00-05:00') = interval '1 hour');
select tests.check('Z-03', 'the day of the change is 25 hours long in Memphis',
  ('2026-11-02 00:00 America/Chicago'::timestamptz - '2026-11-01 00:00 America/Chicago'::timestamptz) = interval '25 hours');

-- Nov 1 2026 has passed, so store the same ambiguous hour at the next change (Nov 7 2027)
select tests.as('ann');
select tests.ok('Z-03', 'Ann sets the swap for Nov 7 2027 1:30 AM CDT',
  $$update public.agreements set exchange_date = '2027-11-07T01:30:00-05:00' where id = 'ZP1'$$);
select tests.check('Z-03', 'stored as 06:30Z',
  (select exchange_date = '2027-11-07T06:30:00.000Z' from public.agreements where id = 'ZP1'),
  (select exchange_date from public.agreements where id = 'ZP1'));
set timezone = 'America/Chicago';
select tests.ok('Z-03', 'with a Memphis session time zone, Ann picks the second 1:30 AM (CST)',
  $$update public.agreements set exchange_date = '2027-11-07T01:30:00-06:00' where id = 'ZP1'$$);
select tests.check('Z-03', 'stored as 07:30Z regardless of the session time zone',
  (select exchange_date = '2027-11-07T07:30:00.000Z' from public.agreements where id = 'ZP1'),
  (select exchange_date from public.agreements where id = 'ZP1'));
reset timezone;
select tests.ok('Z-03', 'a time with no offset is read as UTC (the API session zone)',
  $$update public.agreements set exchange_date = '2027-11-07T01:30:00' where id = 'ZP1'$$);
select tests.check('Z-03', 'stored as 01:30Z',
  (select exchange_date = '2027-11-07T01:30:00.000Z' from public.agreements where id = 'ZP1'));

-- now() can't be moved to the night of a DST change from inside the database,
-- so check the arithmetic the guards use: absolute hours, not calendar days,
-- which a session time zone with DST would stretch or shrink.
select tests.as('trusted');
select tests.check('Z-03', 'late-cancel window is 24 absolute hours (interval ''24 hours''), not ''1 day''',
  pg_get_functiondef('public.agreements_details_guard()'::regprocedure) like '%interval ''24 hours''%'
  and pg_get_functiondef('public.agreements_details_guard()'::regprocedure) not like '%day%''%');
select tests.check('Z-03', 'offer clock is 72 absolute hours',
  pg_get_functiondef('public.offers_guard()'::regprocedure) like '%interval ''72 hours''%'
  and pg_get_functiondef('public.offers_guard()'::regprocedure) not like '%''3 days''%');
select tests.check('Z-03', 'across the 2027 fall-back, 24h before 9 AM Sunday is 10 AM Saturday Memphis time',
  ('2027-11-07 09:00 America/Chicago'::timestamptz - interval '24 hours') = '2027-11-06 10:00 America/Chicago'::timestamptz);

-- ─── Midnight UTC ───────────────────────────────────────────────────────────
select tests.as('ann');
select tests.ok('Z-03', '6 PM CST Nov 20 is midnight UTC Nov 21',
  $$update public.agreements set exchange_date = '2026-11-20T18:00:00-06:00' where id = 'ZP2'$$);
select tests.check('Z-03', 'stored on the UTC day: 2026-11-21T00:00:00.000Z',
  (select exchange_date = '2026-11-21T00:00:00.000Z' from public.agreements where id = 'ZP2'),
  (select exchange_date from public.agreements where id = 'ZP2'));
select tests.ok('Z-03', 'one millisecond before midnight UTC',
  $$update public.agreements set exchange_date = '2026-11-20T23:59:59.999Z' where id = 'ZP2'$$);
select tests.check('Z-03', 'kept as 23:59:59.999Z, not rounded into the next day',
  (select exchange_date = '2026-11-20T23:59:59.999Z' from public.agreements where id = 'ZP2'),
  (select exchange_date from public.agreements where id = 'ZP2'));

-- ─── "Hasn't happened yet" at the boundary ──────────────────────────────────
begin;
select tests.as('ann');
select tests.err('Z-03', 'swap time equal to now is refused',
  format($$update public.agreements set exchange_date = %L where id = 'ZP3'$$, tests.iso_us(now())), 'hasn''t happened');
select tests.ok('Z-03', 'swap time 1 ms from now is accepted',
  format($$update public.agreements set exchange_date = %L where id = 'ZP3'$$, tests.iso(tests.ceil_ms(now()) + interval '1 millisecond')));
commit;

-- ─── Offer expiry at the boundary (expires_at <= now()) ─────────────────────
select tests.as('ann');
select public.make_offer('ox' || g, 'LZ1', 'mx' || g, 'x', array['x']) from generate_series(1, 4) g;
begin;
select tests.as('trusted');
update public.offers set expires_at = now() where id = 'ox1';
update public.offers set expires_at = now() + interval '1 microsecond' where id = 'ox2';
select tests.check('Z-03', 'sweep: an offer due exactly now expires, one due 1 µs later doesn''t',
  public.expire_stale_offers() = 1);
commit;
select tests.check('Z-03', 'ox1 expired, ox2 still pending',
  (select status from public.offers where id = 'ox1') = 'expired'
  and (select status from public.offers where id = 'ox2') = 'pending');

begin;
select tests.as('trusted');
update public.offers set expires_at = now() where id = 'ox3';
update public.offers set expires_at = now() + interval '1 microsecond' where id = 'ox4';
select tests.as('bob');
select tests.err('Z-03', 'accepting at the exact expiry moment is refused',
  $$select public.respond_to_offer('ox3', 'accept', null, 'ok', '{}')$$, 'expired');
select tests.ok('Z-03', 'accepting 1 µs before expiry works',
  $$select public.respond_to_offer('ox4', 'accept', null, 'ok', '{}')$$);
commit;

-- ─── Listing expiry at the boundary (offers need expires_at > now()) ────────
begin;
select tests.as('trusted');
update public.listings set expires_at = now() where id = 'LZ2';
select tests.as('cat');
select tests.err('Z-03', 'no offer on a listing that expires exactly now',
  $$select public.make_offer('oy1', 'LZ2', 'my1', 'x', array['x'])$$, 'row-level security');
select tests.as('trusted');
update public.listings set expires_at = now() + interval '1 microsecond' where id = 'LZ2';
select tests.as('cat');
select tests.ok('Z-03', 'an offer 1 µs before the listing expires works',
  $$select public.make_offer('oy2', 'LZ2', 'my2', 'x', array['x'])$$);
commit;
