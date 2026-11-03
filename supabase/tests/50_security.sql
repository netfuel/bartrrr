-- Row-level security and the RPC surface.
--   S-01 a signed-in neighbor (Bob) can't read or change another neighbor's
--        (Ann's) private rows, in every table and through every RPC
--   S-02 a signed-out visitor (anon) can't write anything or read private
--        data, and can execute only the functions listed here
--
-- Both are driven from the catalog: a table or function added to public
-- without a rule below fails the suite as "unclassified".

-- ─── Fixtures: Ann's rows, in a trade with Cat (Bob is not involved) ────────
select tests.as('trusted');
insert into public.listings (id, title, description, category, seeking, user_id, neighborhood) values
  ('LA', 'Ann''s mixer',  'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young'),
  ('LA2', 'Ann''s tent',  'd', 'goods', 'help', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young'),
  ('LC', 'Cat''s chair',  'd', 'goods', 'help', 'cccccccc-0000-0000-0000-000000000003', 'Binghampton'),
  ('LC2', 'Cat''s rug',   'd', 'goods', 'help', 'cccccccc-0000-0000-0000-000000000003', 'Binghampton'),
  ('LB', 'Bob''s drill',  'd', 'goods', 'help', 'bbbbbbbb-0000-0000-0000-000000000002', 'Midtown');

select tests.as('ann');
select public.make_offer('O-AC', 'LC', 'M-AC', 'Mixer for the chair?', array['Mixer']);
select public.make_offer('O-AC2', 'LC2', 'M-AC2', 'Tent for the rug?', array['Tent']);
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
values ('11111111-0000-0000-0000-00000000000a', tests.uid('ann'), 'https://push.test/ann', 'k', 'a');
select tests.as('cat');
select public.make_offer('O-CA', 'LA', 'M-CA', 'Chair for the mixer?', array['Chair']);
select public.respond_to_offer('O-AC', 'accept', 'M-AC-a', 'Deal', '{}');
insert into public.offer_messages (id, offer_id, from_user_id, type, content)
values ('M-CA-2', 'O-CA', tests.uid('cat'), 'message', 'Ann, my address is 123 Elm');
select tests.as('trusted');
update public.agreements set status = 'completed' where id = 'agreement-O-AC';
select tests.as('cat');
insert into public.reviews (id, agreement_id, reviewer_id, reviewee_id, rating, comment)
values ('R-CA', 'agreement-O-AC', tests.uid('cat'), tests.uid('ann'), 5, 'Lovely mixer');

-- Ann's rows per table
select tests.as('trusted');
create table tests.ann_rows (table_name text, row_id text);
insert into tests.ann_rows
select 'users', tests.uid('ann')
union all select 'listings', id from public.listings where user_id = tests.uid('ann')
union all select 'offers', id from public.offers where tests.uid('ann') in (from_user_id, to_user_id)
union all select 'offer_messages', m.id from public.offer_messages m join public.offers o on o.id = m.offer_id
          where tests.uid('ann') in (o.from_user_id, o.to_user_id)
union all select 'agreements', id from public.agreements where tests.uid('ann') in (party_a_user_id, party_b_user_id)
union all select 'reviews', id from public.reviews where tests.uid('ann') in (reviewer_id, reviewee_id)
union all select 'notifications', id from public.notifications where user_id = tests.uid('ann')
union all select 'push_subscriptions', id::text from public.push_subscriptions where user_id = tests.uid('ann');
grant select on tests.ann_rows to anon, authenticated;

-- ─── The rules: one row per table in public ─────────────────────────────────
-- visibility: 'everyone' (public profile data), 'parties' (the two neighbors
-- in the trade), 'owner' (only the row's own neighbor)
-- touch: a harmless update an attacker would try ("set x = x" still counts
-- as changing the row if it lands)
-- forge: an insert that writes in Ann's name or into her trade
create table tests.table_rules (table_name text primary key, visibility text, touch text, forge text);
insert into tests.table_rules values
  ('users', 'everyone', 'display_name = display_name',
   $$insert into public.users (id, username, display_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'ann_2', 'Ann')$$),
  ('listings', 'everyone', 'title = title',
   $$insert into public.listings (title, description, category, seeking, user_id, neighborhood)
     values ('Fake', 'd', 'goods', 'x', 'aaaaaaaa-0000-0000-0000-000000000001', 'Cooper-Young')$$),
  ('reviews', 'everyone', 'comment = comment',
   $$insert into public.reviews (agreement_id, reviewer_id, reviewee_id, rating, comment)
     values ('agreement-O-AC', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 'fake')$$),
  ('offers', 'parties', 'status = status',
   $$insert into public.offers (listing_id, from_user_id, to_user_id)
     values ('LB', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')$$),
  ('offer_messages', 'parties', 'content = content',
   $$insert into public.offer_messages (offer_id, from_user_id, type, content)
     values ('O-CA', 'bbbbbbbb-0000-0000-0000-000000000002', 'message', 'hi from Bob')$$),
  ('agreements', 'parties', 'special_instructions = special_instructions',
   $$insert into public.agreements (offer_id, party_a_user_id, party_b_user_id)
     values ('O-AC2', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')$$),
  ('notifications', 'owner', 'read_at = now()',
   $$insert into public.notifications (user_id, type, title, body)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'new_message', 'Fake', 'Click here')$$),
  ('push_subscriptions', 'owner', 'endpoint = endpoint',
   $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'https://evil.test/ann', 'k', 'a')$$);
grant select on tests.table_rules to anon, authenticated;

-- ─── Catalog: every table has a rule, fixtures and RLS ──────────────────────
select tests.as('trusted');
do $$
declare
  t record;
begin
  for t in
    select c.relname::text as name, c.relkind, c.relrowsecurity,
           r.table_name is not null as ruled,
           exists (select 1 from tests.ann_rows a where a.table_name = c.relname) as has_rows
      from pg_class c
      left join tests.table_rules r on r.table_name = c.relname
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
     order by 1
  loop
    perform tests.check('S-01', format('%s: classified in tests.table_rules', t.name), t.ruled,
      'unclassified table: add it to tests.table_rules in 50_security.sql with its visibility and attack statements');
    perform tests.check('S-01', format('%s: row-level security enabled', t.name),
      t.relkind in ('r', 'p') and t.relrowsecurity,
      case when t.relkind in ('r', 'p') then 'RLS is off' else 'not a plain table: views bypass RLS unless security_invoker' end);
    if t.ruled then
      perform tests.check('S-01', format('%s: has fixture rows for Ann', t.name), t.has_rows,
        'no Ann rows to attack: add fixtures in 50_security.sql');
    end if;
  end loop;
  -- rules for tables that no longer exist
  perform tests.check('S-01', format('rule for %s matches a real table', r.table_name), false, 'stale rule')
    from tests.table_rules r
   where to_regclass('public.' || r.table_name) is null;
end $$;

select tests.check('S-01', 'every table in the realtime publication has RLS (Realtime filters changes by it)',
  not exists (select 1 from pg_publication_tables pt join pg_class c on c.relname = pt.tablename
                and c.relnamespace = 'public'::regnamespace
               where pt.pubname = 'supabase_realtime' and not c.relrowsecurity));

-- ─── S-01 Bob vs Ann's rows, per table ──────────────────────────────────────
do $$
declare
  r record;
  v_ids text;
  v_where text;
begin
  for r in select * from tests.table_rules order by table_name loop
    select quote_literal(array_agg(row_id)::text) into v_ids from tests.ann_rows where table_name = r.table_name;
    continue when v_ids is null;
    v_where := format('id::text = any(%s::text[])', v_ids);

    -- positive control: Ann herself sees all of them
    perform tests.as('ann');
    perform tests.check('S-01', format('%s: (control) Ann sees her own rows', r.table_name),
      tests.count(format('select 1 from public.%I where %s', r.table_name, v_where))
        = (select count(*) from tests.ann_rows a where a.table_name = r.table_name));

    perform tests.as('bob');
    if r.visibility <> 'everyone' then
      perform tests.no_rows('S-01', format('%s: Bob can''t read Ann''s rows', r.table_name),
        format('select * from public.%I where %s', r.table_name, v_where));
    end if;
    perform tests.no_effect('S-01', format('%s: Bob can''t update Ann''s rows', r.table_name),
      format('update public.%I set %s where %s', r.table_name, r.touch, v_where));
    perform tests.no_effect('S-01', format('%s: Bob can''t delete Ann''s rows', r.table_name),
      format('delete from public.%I where %s', r.table_name, v_where));
    perform tests.no_effect('S-01', format('%s: Bob can''t insert in Ann''s name or into her trade', r.table_name),
      r.forge);
  end loop;
  perform tests.as('trusted');
end $$;

-- Specific private columns and server-owned fields
select tests.as('bob');
select tests.no_rows('S-01', 'offer_messages: Bob can''t read the address Cat sent Ann',
  $$select 1 from public.offer_messages where content like '%123 Elm%'$$);
select tests.no_rows('S-01', 'notifications: Bob sees none of Ann''s notifications by any filter',
  $$select 1 from public.notifications where user_id <> 'bbbbbbbb-0000-0000-0000-000000000002'$$);
select tests.err('S-01', 'users: Bob can''t raise his own reputation_score',
  $$update public.users set reputation_score = 5 where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'permission denied');
select tests.err('S-01', 'users: Bob can''t raise his own trade_count',
  $$update public.users set trade_count = 99 where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'permission denied');
select tests.ok('S-01', 'listings: Bob tries to hand his listing to Ann (owner is pinned, so the update lands as a no-op)',
  $$update public.listings set user_id = 'aaaaaaaa-0000-0000-0000-000000000001' where id = 'LB'$$);
select tests.check('S-01', 'listings: LB still belongs to Bob',
  (select user_id = tests.uid('bob') from public.listings where id = 'LB'));
select tests.err('S-01', 'notifications: Bob can only change read_at on his own',
  $$update public.notifications set body = 'x' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'permission denied');

-- ─── S-01 every RPC Bob can call ────────────────────────────────────────────
select tests.as('trusted');
create table tests.rpc_rules (fn text primary key, why text);
insert into tests.rpc_rules values
  ('make_offer(text,text,text,text,text[])', 'acts as the caller; checked below'),
  ('respond_to_offer(text,text,text,text,text[])', 'acts as the caller under RLS; checked below'),
  ('delete_my_account()', 'only ever deletes the caller (40_deletion.sql X-02/X-03)'),
  ('agreement_exchange_at(text)', 'parses a string; reads no table');
select tests.check('S-01', 'RPC classified: ' || p.oid::regprocedure::text,
         exists (select 1 from tests.rpc_rules r where r.fn = p.oid::regprocedure::text),
         'unclassified RPC executable by signed-in neighbors: add a rule and a test in 50_security.sql')
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and has_function_privilege('authenticated', p.oid, 'execute')
 order by p.oid::regprocedure::text;
select tests.check('S-01', 'signed-in neighbors can execute exactly the classified RPCs',
  (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute'))
  = (select array_agg(fn order by fn) from tests.rpc_rules),
  (select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')));

select tests.as('bob');
select tests.err('S-01', 'respond_to_offer: Bob can''t accept Cat''s offer to Ann',
  $$select public.respond_to_offer('O-CA', 'accept', null, 'ok', '{}')$$, 'Offer not found');
select tests.err('S-01', 'respond_to_offer: Bob can''t decline it',
  $$select public.respond_to_offer('O-CA', 'decline', null, 'not_fair', '{}')$$, 'Offer not found');
select tests.err('S-01', 'respond_to_offer: Bob can''t counter it',
  $$select public.respond_to_offer('O-CA', 'counter', null, 'x', array['x'])$$, 'Offer not found');
select tests.err('S-01', 'respond_to_offer: Bob can''t withdraw Ann''s offer to Cat',
  $$select public.respond_to_offer('O-AC2', 'withdraw', null, null, '{}')$$, 'Offer not found');
select tests.err('S-01', 'make_offer: reusing Ann''s offer id doesn''t overwrite it',
  $$select public.make_offer('O-AC2', 'LA2', 'M-new', 'x', array['x'])$$, '');
select tests.err('S-01', 'make_offer: reusing a message id from Ann''s thread doesn''t overwrite it',
  $$select public.make_offer('O-new', 'LA2', 'M-CA-2', 'x', array['x'])$$, '');
select tests.as('trusted');
select tests.check('S-01', 'Ann''s offers and messages unchanged after all of the above',
  (select status = 'pending' and from_user_id = tests.uid('ann') from public.offers where id = 'O-AC2')
  and (select status = 'pending' from public.offers where id = 'O-CA')
  and (select content = 'Ann, my address is 123 Elm' and from_user_id = tests.uid('cat') from public.offer_messages where id = 'M-CA-2')
  and not exists (select 1 from public.offer_messages where from_user_id = tests.uid('bob')));

-- ─── S-02 anon ──────────────────────────────────────────────────────────────
select tests.check('S-02', 'anon can execute exactly: agreement_exchange_at(text)',
  (select coalesce(array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text), '{}') from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute'))
  = array['agreement_exchange_at(text)'],
  (select 'anon can execute: ' || coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), 'nothing') from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')));

do $$
declare
  r record;
begin
  perform tests.as('anon');
  for r in select * from tests.table_rules order by table_name loop
    if r.visibility <> 'everyone' then
      perform tests.no_rows('S-02', format('%s: anon reads nothing', r.table_name),
        format('select * from public.%I', r.table_name));
    else
      perform tests.check('S-02', format('%s: anon can read public rows (control)', r.table_name),
        tests.count(format('select 1 from public.%I', r.table_name)) > 0);
    end if;
    perform tests.no_effect('S-02', format('%s: anon can''t update any row', r.table_name),
      format('update public.%I set %s', r.table_name, r.touch));
    perform tests.no_effect('S-02', format('%s: anon can''t delete any row', r.table_name),
      format('delete from public.%I', r.table_name));
    perform tests.no_effect('S-02', format('%s: anon can''t insert', r.table_name), r.forge);
  end loop;
  perform tests.as('trusted');
end $$;

select tests.as('anon');
select tests.err('S-02', 'anon can''t make an offer',
  $$select public.make_offer('O-anon', 'LA2', 'M-anon', 'x', array['x'])$$, 'permission denied');
select tests.err('S-02', 'anon can''t respond to an offer',
  $$select public.respond_to_offer('O-CA', 'decline', null, 'x', '{}')$$, 'permission denied');
select tests.err('S-02', 'anon can''t run the expiry sweep',
  $$select public.expire_stale_offers()$$, 'permission denied');
select tests.err('S-02', 'anon can''t send notifications',
  $$select public.notify('aaaaaaaa-0000-0000-0000-000000000001', 'new_message', 'x', 'y', '{}')$$, 'permission denied');
select tests.err('S-02', 'anon can''t read auth.users',
  $$select * from auth.users$$, 'permission denied');
select tests.check('S-02', 'agreement_exchange_at only parses: same answer for anon, no table access',
  public.agreement_exchange_at('2026-12-01T18:00:00Z') = '2026-12-01 18:00:00+00'::timestamptz
  and (select prosecdef = false and provolatile = 's' from pg_proc where oid = 'public.agreement_exchange_at(text)'::regprocedure));
