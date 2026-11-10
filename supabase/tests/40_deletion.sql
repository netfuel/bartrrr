-- Account deletion (007 operator function, 010 self-service, 013 fresh sign-in):
--   X-02 a neighbor deletes their own account, then their photos
--   X-03 nobody can delete someone else's account (or the auth rows)
--   X-04 deleting needs a sign-in from the last 10 minutes (013)
--   N-02 other neighbors' notifications lose the leaving neighbor's name
--   V-02 afterwards the old name appears nowhere other neighbors can read
--
-- Ann leaves. Bob traded with her, Cat had an open offer from her, Dan got an
-- offer from her back when her profile said "Alexandra Alpha".

select tests.as('trusted');
update public.users set display_name = 'Ann Alpha', bio = 'Ann bio',
       avatar_url = 'https://x.test/a.webp', interests = array['goods']
 where id = tests.uid('ann');

insert into public.listings (id, title, description, category, seeking, images, user_id, neighborhood) values
  ('LA1', 'Brass lamp',         'Nobody offered', 'goods', 'books', '{https://x.test/1.webp}', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young'),
  ('LA2', 'Road bike',          'Bob offered',    'goods', 'tools', '{https://x.test/2.webp}', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young'),
  ('LB1', 'Cordless drill',     'Active trade',   'goods', 'help',  '{}', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown'),
  ('LB2', 'Leaf rake',          'Done trade',     'goods', 'help',  '{}', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown'),
  ('LB3', 'Annual garden pass', 'Ann offered',    'goods', 'help',  '{}', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown'),
  ('LC1', 'Rocking chair',      'Not involved',   'goods', 'help',  '{}', 'cccccccc-0000-0000-0000-000000000003', 'Binghampton'),
  ('LC2', 'Planter boxes',      'Ann offered',    'goods', 'help',  '{}', 'cccccccc-0000-0000-0000-000000000003', 'Binghampton'),
  ('LD1', 'Kayak',              'Ann offered',    'outdoor', 'help', '{}', 'dddddddd-0000-0000-0000-000000000004', 'Crosstown');

insert into public.offers (id, listing_id, from_user_id, to_user_id, status) values
  ('O1', 'LA2', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending'),
  ('O2', 'LB1', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'accepted'),
  ('O3', 'LB2', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'accepted'),
  ('O4', 'LC1', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', 'pending'),
  ('O5', 'LB1', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'countered');
insert into public.offer_messages (id, offer_id, from_user_id, type, content) values
  ('M1', 'O2', 'aaaaaaaa-0000-0000-0000-000000000001', 'offer', 'Hi Bob, it''s Ann');
insert into public.agreements (id, offer_id, party_a_user_id, party_b_user_id, party_a_item, party_b_item, status) values
  ('AG1', 'O2', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'tutoring', 'drill', 'active'),
  ('AG2', 'O3', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cookies',  'rake',  'completed');
insert into public.reviews (id, agreement_id, reviewer_id, reviewee_id, rating, comment) values
  ('R1', 'AG2', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 5, 'Great cookies');
insert into public.notifications (id, user_id, type, title, body, offer_id) values
  ('N1', 'bbbbbbbb-0000-0000-0000-000000000002', 'new_offer', 'Ann wants to trade', 'Ann Alpha offered on your drill', 'O2'),
  ('N2', 'aaaaaaaa-0000-0000-0000-000000000001', 'new_offer', 'Bob wants to trade', 'Bob offered on your bike', 'O1'),
  ('N3', 'cccccccc-0000-0000-0000-000000000003', 'new_offer', 'Bob wants to trade', 'Bob offered on your chair', 'O4'),
  -- Not a server template: only whole-word name matching applies
  ('N4', 'bbbbbbbb-0000-0000-0000-000000000002', 'new_message', 'Note from Ann', 'Hi! Ann here: the Annual pass is ready, Ann.', 'O2');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'https://push.test/a', 'k', 'a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'https://push.test/b', 'k', 'b');
insert into storage.objects (bucket_id, name) values
  ('listing-photos', 'aaaaaaaa-0000-0000-0000-000000000001/1.webp'),
  ('listing-photos', 'bbbbbbbb-0000-0000-0000-000000000002/2.webp');

-- What Ann does through the app, generating notifications with her name
select tests.as('ann');
-- For a while her profile said "Alexandra Alpha"
update public.users set display_name = 'Alexandra Alpha' where id = tests.uid('ann');
select public.make_offer('O-dan', 'LD1', 'M-dan', 'Kayak for a canoe paddle?', array['Canoe paddle']);
update public.users set display_name = 'Ann Alpha' where id = tests.uid('ann');
select public.make_offer('O-pass', 'LB3', 'M-pass', 'For the pass?', array['Jam']);
select public.make_offer('O-cat', 'LC2', 'M-cat', 'Planters for herbs?', array['Herb starts']);
insert into public.offer_messages (id, offer_id, from_user_id, type, content)
values ('M-cat-2', 'O-cat', tests.uid('ann'), 'message', 'Are they cedar?');
insert into public.reviews (agreement_id, reviewer_id, reviewee_id, rating, comment)
values ('AG2', tests.uid('ann'), tests.uid('bob'), 4, 'Good rake');

select tests.as('bob');
select tests.check('N-02', 'before: Bob''s notifications name Ann',
  exists (select 1 from public.notifications where body like 'Ann wants to trade for your Annual garden pass%')
  and exists (select 1 from public.notifications where body = 'Ann left you a review.'));

-- ─── X-03 nobody can delete someone else ────────────────────────────────────
select tests.as('trusted');
select tests.check('X-03', 'delete_my_account: executable by signed-in neighbors only',
  has_function_privilege('authenticated', 'public.delete_my_account()', 'execute')
  and not has_function_privilege('anon', 'public.delete_my_account()', 'execute'));
select tests.check('X-03', 'delete_account(<id>) (operator) is not executable by anon or signed-in neighbors',
  not has_function_privilege('authenticated', 'public.delete_account(text)', 'execute')
  and not has_function_privilege('anon', 'public.delete_account(text)', 'execute'));
select tests.check('X-03', 'delete_my_account is security definer (it must reach auth.users)',
  (select prosecdef from pg_proc where oid = 'public.delete_my_account()'::regprocedure));

select tests.as('anon');
select tests.err('X-03', 'anon cannot call delete_my_account',
  $$select public.delete_my_account()$$, 'permission denied');
select tests.as('ann');
select tests.err('X-03', 'signed-in Ann cannot call delete_account(Bob)',
  $$select public.delete_account('bbbbbbbb-0000-0000-0000-000000000002')$$, 'permission denied');
select tests.err('X-03', 'delete_my_account takes no target id',
  $$select public.delete_my_account('bbbbbbbb-0000-0000-0000-000000000002')$$, 'does not exist');
select tests.err('X-03', 'signed-in Ann cannot delete auth rows directly',
  $$delete from auth.users$$, 'permission denied');
-- Signed-in role but no subject in the token
select tests.as('trusted');
set role authenticated;
select tests.err('X-03', 'a session with no user id is refused',
  $$select public.delete_my_account()$$, 'Sign in to delete');
reset role;

-- ─── X-04 deleting needs a fresh sign-in (013) ──────────────────────────────
-- tests.signed_in(who, ago, method): Ann's token, as Supabase Auth issues it,
-- for a session that signed in `ago` before now. The amr timestamp is when
-- that sign-in happened; iat is when this token was issued (every refresh).
select tests.as('trusted');
create function tests.signed_in(p_who text, p_ago interval, p_method text default 'password',
                                p_extra jsonb default '{}'::jsonb) returns void
language plpgsql as $$
begin
  perform tests.as(p_who);
  perform set_config('request.jwt.claims',
    (jsonb_build_object(
       'sub', tests.uid(p_who), 'role', 'authenticated',
       'iat', floor(extract(epoch from now())),
       'amr', jsonb_build_array(jsonb_build_object(
                'method', p_method, 'timestamp', floor(extract(epoch from now() - p_ago)))))
     || p_extra)::text, false);
end $$;

-- SQLSTATE a statement fails with (null if it runs; its effects are kept)
create function tests.sqlstate_of(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end $$;

-- True when the statement runs; always rolled back
create function tests.runs_then_rollback(p_sql text) returns boolean
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'tests.rollback';
exception when others then
  if sqlerrm <> 'tests.rollback' then
    raise notice 'runs_then_rollback: % (%)', sqlerrm, sqlstate;
  end if;
  return sqlerrm = 'tests.rollback';
end $$;

-- Ann's sign-in is from yesterday, but her current token is new: the token
-- refreshes every hour, so iat alone must not count as a fresh sign-in.
update auth.users set last_sign_in_at = now() - interval '1 day' where id = tests.uid('ann')::uuid;

select tests.as('ann');
select tests.err('X-04', 'a token with no amr and an old last sign-in is refused',
  $$select public.delete_my_account()$$, 'Confirm it''s you again');
select tests.check('X-04', 'the refusal is SQLSTATE 28000 (the app shows the confirm step again)',
  tests.sqlstate_of('select public.delete_my_account()') = '28000');

select tests.signed_in('ann', interval '11 minutes');
select tests.err('X-04', 'a password sign-in 11 minutes ago is refused (token just refreshed)',
  $$select public.delete_my_account()$$, 'Confirm it''s you again');
select tests.signed_in('ann', interval '3 hours', 'oauth');
select tests.err('X-04', 'a Google sign-in 3 hours ago is refused',
  $$select public.delete_my_account()$$, 'Confirm it''s you again');
select tests.signed_in('ann', interval '1 minute', 'token_refresh');
select tests.err('X-04', 'a recent token_refresh entry doesn''t count as signing in',
  $$select public.delete_my_account()$$, 'Confirm it''s you again');

-- Signing in on another device moves last_sign_in_at, not this session's amr
select tests.as('trusted');
update auth.users set last_sign_in_at = now() - interval '1 minute' where id = tests.uid('ann')::uuid;
select tests.signed_in('ann', interval '2 hours');
select tests.err('X-04', 'an old session stays refused after a fresh sign-in elsewhere',
  $$select public.delete_my_account()$$, 'Confirm it''s you again');

select tests.as('trusted');
select tests.check('X-04', 'nothing changed after the refusals',
  (select display_name from public.users where id = tests.uid('ann')) = 'Ann Alpha'
  and exists (select 1 from auth.users where id = tests.uid('ann')::uuid)
  and (select count(*) from public.listings where user_id = tests.uid('ann')) = 2);

-- Fresh sign-ins are let through (checked in a rolled-back transaction)
select tests.signed_in('ann', interval '9 minutes');
select tests.check('X-04', 'a password sign-in 9 minutes ago is allowed',
  tests.runs_then_rollback('select public.delete_my_account()'));
select tests.signed_in('ann', interval '30 seconds', 'oauth');
select tests.check('X-04', 'a Google sign-in 30 seconds ago is allowed',
  tests.runs_then_rollback('select public.delete_my_account()'));
select tests.signed_in('ann', interval '1 minute', 'password',
  jsonb_build_object('amr', jsonb_build_array(
    jsonb_build_object('method', 'password', 'timestamp', floor(extract(epoch from now() - interval '5 hours'))),
    jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch from now() - interval '2 minutes'))))));
select tests.check('X-04', 'with several sign-in methods, the newest one counts',
  tests.runs_then_rollback('select public.delete_my_account()'));
-- A token without amr (custom access token hook) falls back to last_sign_in_at
select tests.as('ann');
select tests.check('X-04', 'no amr: a last sign-in 1 minute ago is allowed',
  tests.runs_then_rollback('select public.delete_my_account()'));
select tests.as('trusted');
select tests.check('X-04', 'still nothing changed after the rolled-back runs',
  (select display_name from public.users where id = tests.uid('ann')) = 'Ann Alpha'
  and exists (select 1 from auth.users where id = tests.uid('ann')::uuid));

-- ─── X-02 Ann deletes her account, then her photos ──────────────────────────
-- She types her password again in the dialog: a new session
select tests.signed_in('ann', interval '5 seconds');
select tests.ok('X-02', 'Ann deletes her account', $$select public.delete_my_account()$$);
select tests.ok('X-02', 'calling it again (double tap, retry) is harmless', $$select public.delete_my_account()$$);
-- Storage has no foreign key from objects to auth.users (storage migration
-- 0017), so her files outlive the sign-in. The app then removes them through
-- the Storage API with her still-valid token (008 policies match its sub).
select tests.check('X-02', 'her photos are still there after the sign-in is gone',
  (select count(*) = 1 from storage.objects where name like 'aaaaaaaa%'));
select tests.check('X-02', 'with her old token, Ann lists only her own photos', (select count(*) = 1 from storage.objects));
select tests.ok('X-02', 'with her old token, Ann removes her photos', $$delete from storage.objects where bucket_id = 'listing-photos'$$);

select tests.as('trusted');
select tests.check('X-02', 'photos: Ann''s gone, Bob''s kept',
  (select count(*) = 0 from storage.objects where name like 'aaaaaaaa%')
  and (select count(*) = 1 from storage.objects where name like 'bbbbbbbb%'));
select tests.check('X-02', 'sign-in and identities gone',
  not exists (select 1 from auth.users where id = tests.uid('ann')::uuid)
  and not exists (select 1 from auth.identities where user_id = tests.uid('ann')::uuid));
select tests.check('X-02', 'profile is "Former neighbor" with nothing personal',
  (select display_name = 'Former neighbor' and username like 'former\_%' and avatar_url is null and bio is null
          and neighborhood = '' and interests = '{}' from public.users where id = tests.uid('ann')));
select tests.check('X-02', 'listing nobody offered on is deleted', not exists (select 1 from public.listings where id = 'LA1'));
select tests.check('X-02', 'listing with offers is taken down and cleared',
  (select status = 'withdrawn' and description = '' and images = '{}' from public.listings where id = 'LA2'));
select tests.check('X-02', 'her open offers (sent and received) are withdrawn',
  (select bool_and(status = 'withdrawn') from public.offers where id in ('O1', 'O5', 'O-dan', 'O-pass', 'O-cat')));
select tests.check('X-02', 'accepted offer stays accepted', (select status from public.offers where id = 'O2') = 'accepted');
select tests.check('X-02', 'unfinished agreement cancelled, completed one kept',
  (select status from public.agreements where id = 'AG1') = 'cancelled'
  and (select status from public.agreements where id = 'AG2') = 'completed');
select tests.check('X-02', 'reviews and messages kept for the other neighbor',
  (select count(*) = 2 from public.reviews where agreement_id = 'AG2')
  and exists (select 1 from public.offer_messages where id = 'M1'));
select tests.check('X-02', 'her notifications and push subscriptions are gone',
  not exists (select 1 from public.notifications where user_id = tests.uid('ann'))
  and not exists (select 1 from public.push_subscriptions where user_id = tests.uid('ann')));
select tests.check('X-02', 'Bob is untouched: sign-in, profile, push, listings',
  exists (select 1 from auth.users where id = tests.uid('bob')::uuid)
  and (select display_name from public.users where id = tests.uid('bob')) = 'Bob Beta'
  and exists (select 1 from public.push_subscriptions where user_id = tests.uid('bob'))
  and (select count(*) = 3 from public.listings where user_id = tests.uid('bob')));
select tests.check('X-02', 'Cat''s listing and Bob''s offer to Cat untouched',
  (select status from public.listings where id = 'LC1') = 'active'
  and (select status from public.offers where id = 'O4') = 'pending');

-- ─── N-02 notifications lose her name ───────────────────────────────────────
select tests.check('N-02', 'Bob''s N1 title redacted',
  (select title from public.notifications where id = 'N1') = 'A former neighbor wants to trade',
  (select title from public.notifications where id = 'N1'));
select tests.check('N-02', 'Bob''s N1 body redacted (full name and first name)',
  (select position('Ann' in body) = 0 and position('Alpha' in body) = 0 from public.notifications where id = 'N1'),
  (select body from public.notifications where id = 'N1'));
select tests.check('N-02', 'Bob''s review notice says a former neighbor',
  exists (select 1 from public.notifications where user_id = tests.uid('bob') and body = 'A former neighbor left you a review.'));
select tests.check('N-02', 'Cat''s message notice is redacted',
  exists (select 1 from public.notifications where user_id = tests.uid('cat') and offer_id = 'O-cat'
            and type = 'new_message' and body = 'A former neighbor: Are they cedar?'),
  (select string_agg(body, ' | ') from public.notifications where offer_id = 'O-cat'));
select tests.check('N-02', 'notifications not about Ann are untouched',
  (select title from public.notifications where id = 'N3') = 'Bob wants to trade');
select tests.check('N-02', 'redaction leaves the rest of the text alone',
  exists (select 1 from public.notifications where offer_id = 'O-pass' and type = 'new_offer'
            and body = 'A former neighbor wants to trade for your Annual garden pass. Take a look.'),
  (select body from public.notifications where offer_id = 'O-pass' and type = 'new_offer'));
select tests.check('N-02', 'a notice that fits no template: whole words only ("Annual" kept)',
  (select title = 'Note from A former neighbor'
          and body = 'Hi! A former neighbor here: the Annual pass is ready, A former neighbor.'
     from public.notifications where id = 'N4'),
  (select title || ' / ' || body from public.notifications where id = 'N4'));
select tests.check('N-02', 'a notice sent under an earlier name ("Alexandra") is redacted by template',
  exists (select 1 from public.notifications where offer_id = 'O-dan' and type = 'new_offer'
            and body = 'A former neighbor wants to trade for your Kayak. Take a look.'),
  (select string_agg(body, ' | ') from public.notifications where offer_id = 'O-dan'));

-- ─── V-02 the old name appears nowhere other neighbors can read ─────────────
-- Scans every text-like column of every public table that the reader can
-- select (RLS applies). Columns holding what neighbors typed themselves
-- (listing text, messages, review comments, agreement terms) are out of scope:
-- nobody can scrub a name out of free text another person wrote.
select tests.as('trusted');
create function tests.name_hits(p_pattern text) returns setof text
language plpgsql as $$
declare
  c record;
  v text;
begin
  for c in
    select cl.relname::text as table_name, a.attname::text as column_name
      from pg_class cl
      join pg_namespace ns on ns.oid = cl.relnamespace and ns.nspname = 'public'
      join pg_attribute a on a.attrelid = cl.oid and a.attnum > 0 and not a.attisdropped
     where cl.relkind in ('r', 'p', 'v')
       and a.atttypid in ('text'::regtype, 'varchar'::regtype, 'jsonb'::regtype, 'text[]'::regtype)
       -- per column: users is readable column by column (012, T-26)
       and has_column_privilege(cl.oid, a.attnum, 'select')
       and (cl.relname::text, a.attname::text) not in (
         ('listings', 'title'), ('listings', 'description'), ('listings', 'seeking'),
         ('offer_messages', 'content'), ('offer_messages', 'items'),
         ('reviews', 'comment'),
         ('agreements', 'party_a_item'), ('agreements', 'party_b_item'),
         ('agreements', 'exchange_location'), ('agreements', 'special_instructions'),
         ('agreements', 'dispute_reason'))
  loop
    for v in execute format('select %1$I::text from public.%2$I where %1$I::text ~ $1', c.column_name, c.table_name)
      using p_pattern
    loop
      return next format('%s.%s: %s', c.table_name, c.column_name, v);
    end loop;
  end loop;
end $$;
grant execute on function tests.name_hits(text) to anon, authenticated;

-- Word match, so "Annual" isn't a hit; also the old username and email
\set name_pattern '''\\m(Ann|Alpha|Alexandra)\\M|ann_alpha|ann@example\\.com'''

select tests.as('bob');
select tests.check('V-02', 'Bob (traded with her) finds her name nowhere',
  not exists (select 1 from tests.name_hits(:name_pattern)),
  (select string_agg(h, ' | ') from tests.name_hits(:name_pattern) h));
select tests.as('cat');
select tests.check('V-02', 'Cat (had an open offer from her) finds her name nowhere',
  not exists (select 1 from tests.name_hits(:name_pattern)),
  (select string_agg(h, ' | ') from tests.name_hits(:name_pattern) h));
select tests.as('anon');
select tests.check('V-02', 'a signed-out visitor finds her name nowhere',
  not exists (select 1 from tests.name_hits(:name_pattern)),
  (select string_agg(h, ' | ') from tests.name_hits(:name_pattern) h));
select tests.as('dan');
select tests.check('V-02', 'Dan (offered to when she was "Alexandra") finds her name nowhere',
  not exists (select 1 from tests.name_hits(:name_pattern)),
  (select string_agg(h, ' | ') from tests.name_hits(:name_pattern) h));
