-- Test harness: lives in its own schema so the catalog checks in
-- 50_security.sql only see the app's tables and functions in public.
--
-- Every check prints one line through RAISE NOTICE:
--   PASS  <ID> <description>
--   FAIL  <ID> <description> (<why>)
--   XFAIL <ID> <description> BUG: <one line>      known app bug, run stays green
--   XPASS <ID> <description> (...)                known bug no longer reproduces:
--                                                  fails the run so the mark is removed
--
-- Mark a known bug by calling tests.expect_bug('<one line>') right before the
-- check it affects. The mark applies to that one check only.

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- ─── Who is acting ──────────────────────────────────────────────────────────

create function tests.uid(p_who text) returns text
language sql immutable as $$
  select case lower(p_who)
    when 'ann' then 'aaaaaaaa-0000-0000-0000-000000000001'
    when 'bob' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'cat' then 'cccccccc-0000-0000-0000-000000000003'
    when 'dan' then 'dddddddd-0000-0000-0000-000000000004'
    else p_who
  end
$$;

-- tests.as('ann' | 'bob' | 'cat' | 'dan' | <uuid>)  signed-in neighbor (role authenticated)
-- tests.as('anon')                                   signed-out visitor
-- tests.as('service_role')                           server key, no user
-- tests.as('trusted')                                migration / SQL editor / pg_cron (postgres, no claims)
create function tests.as(p_who text) returns void
language plpgsql as $$
declare
  v_uid text;
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', '', false);
  perform set_config('request.jwt.claims', '', false);

  if p_who = 'trusted' then
    return;
  elsif p_who in ('anon', 'service_role') then
    perform set_config('request.jwt.claim.role', p_who, false);
    perform set_config('request.jwt.claims', json_build_object('role', p_who)::text, false);
    execute format('set role %I', p_who);
  else
    v_uid := tests.uid(p_who);
    perform set_config('request.jwt.claim.sub', v_uid, false);
    perform set_config('request.jwt.claim.role', 'authenticated', false);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated')::text, false);
    execute 'set role authenticated';
  end if;
end $$;

-- ─── Reporting ──────────────────────────────────────────────────────────────

create function tests.expect_bug(p_bug text) returns void
language sql as $$
  select set_config('tests.next_bug', p_bug, false);
$$;

create function tests.report(p_id text, p_desc text, p_pass boolean, p_why text default null)
returns void
language plpgsql as $$
declare
  v_bug text := nullif(current_setting('tests.next_bug', true), '');
begin
  perform set_config('tests.next_bug', '', false);
  if v_bug is null then
    if coalesce(p_pass, false) then
      raise notice '%', format('PASS  %s %s', p_id, p_desc);
    else
      raise notice '%', format('FAIL  %s %s (%s)', p_id, p_desc, coalesce(p_why, 'check was false'));
    end if;
  else
    if coalesce(p_pass, false) then
      raise notice '%', format('XPASS %s %s (marked as a known bug but it passed: "%s". Remove the expect_bug mark.)',
        p_id, p_desc, v_bug);
    else
      raise notice '%', format('XFAIL %s %s BUG: %s', p_id, p_desc, v_bug);
    end if;
  end if;
end $$;

-- Condition is true
create function tests.check(p_id text, p_desc text, p_cond boolean, p_why text default null)
returns void
language sql as $$
  select tests.report(p_id, p_desc, coalesce(p_cond, false),
    coalesce(p_why, case when p_cond is null then 'check was null' else 'check was false' end));
$$;

-- Statement runs without an error (its effects are kept)
create function tests.ok(p_id text, p_desc text, p_sql text) returns void
language plpgsql as $$
declare
  v_err text;
begin
  begin
    execute p_sql;
  exception when others then
    v_err := sqlerrm;
  end;
  perform tests.report(p_id, p_desc, v_err is null, 'unexpected error: ' || v_err);
end $$;

-- Statement fails with an error whose message contains p_like (case-insensitive)
create function tests.err(p_id text, p_desc text, p_sql text, p_like text) returns void
language plpgsql as $$
declare
  v_err text;
begin
  begin
    execute p_sql;
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    perform tests.report(p_id, p_desc, false, 'no error');
  elsif v_err ilike '%' || p_like || '%' then
    perform tests.report(p_id, p_desc, true);
  else
    perform tests.report(p_id, p_desc, false, 'wrong error: ' || v_err);
  end if;
end $$;

-- A write that must not land: passes when it is refused for lack of privilege
-- or RLS (SQLSTATE 42501), or when it matches zero rows. The attempt is always
-- rolled back, so a failing check doesn't change the fixtures for later checks.
create function tests.no_effect(p_id text, p_desc text, p_sql text) returns void
language plpgsql as $$
declare
  v_rows bigint;
  v_state text;
  v_err text;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    raise exception using errcode = 'XT001', message = v_rows::text;
  exception
    when sqlstate 'XT001' then
      v_rows := sqlerrm::bigint;
    when others then
      v_state := sqlstate;
      v_err := sqlerrm;
  end;
  if v_state is not null then
    perform tests.report(p_id, p_desc, v_state = '42501',
      format('unexpected error %s: %s', v_state, v_err));
  else
    perform tests.report(p_id, p_desc, v_rows = 0, format('changed %s row(s)', v_rows));
  end if;
end $$;

-- A read that must come back empty: passes when it is refused (42501) or
-- returns no rows. p_sql is a query.
create function tests.no_rows(p_id text, p_desc text, p_sql text) returns void
language plpgsql as $$
declare
  v_rows bigint;
  v_state text;
  v_err text;
begin
  begin
    execute format('select count(*) from (%s) q', p_sql) into v_rows;
  exception when others then
    v_state := sqlstate;
    v_err := sqlerrm;
  end;
  if v_state is not null then
    perform tests.report(p_id, p_desc, v_state = '42501',
      format('unexpected error %s: %s', v_state, v_err));
  else
    perform tests.report(p_id, p_desc, v_rows = 0, format('saw %s row(s)', v_rows));
  end if;
end $$;

-- Row count of a query, run as the current role
create function tests.count(p_sql text) returns bigint
language plpgsql as $$
declare
  v bigint;
begin
  execute format('select count(*) from (%s) q', p_sql) into v;
  return v;
end $$;

-- Is a timestamp within p_tol of an expected value
create function tests.near(p_actual timestamptz, p_expected timestamptz, p_tol interval default interval '1 minute')
returns boolean
language sql immutable as $$
  select p_actual between p_expected - p_tol and p_expected + p_tol;
$$;

-- Exchange time as the client sends it: an ISO string with an offset
create function tests.iso(p_at timestamptz) returns text
language sql immutable as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
