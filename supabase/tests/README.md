# Database rules tests (layer 1)

SQL tests for what the database itself enforces: row-level security, the guard
triggers, the RPCs, notifications, account deletion and storage policies. They
run against plain Postgres with small Supabase stand-ins, so they need no
Supabase CLI, Docker or network.

```sh
npm run test:db          # same as: bash supabase/tests/run.sh
```

## What a run does

1. Creates a template database and applies, in order:
   `setup/00_supabase_stubs.sql` (roles `anon` / `authenticated` / `service_role`,
   `auth.users`, `auth.uid()`, `storage.buckets` / `storage.objects` /
   `storage.foldername()`, the `supabase_realtime` publication, the
   `extensions` schema and Supabase's default grants on `public`), then every
   `supabase/migrations/0*.sql`, then `setup/10_harness.sql` (the `tests`
   schema) and `setup/20_fixtures.sql` (four neighbors: Ann, Bob, Cat, Dan).
2. Runs each `NN_*.sql` file in its own copy of the template, so files don't
   share state and can run in any order.
3. Drops every database it created (and the three API roles, if it created
   them), prints a summary and exits non-zero on any `FAIL` or `XPASS`, or if
   a file aborts on an unexpected error.

| File | Cases |
|---|---|
| `10_listings.sql` | L-07 coordinates rounded to ~1 km, L-08 30-day expiry and renewal, L-10 match notifications |
| `20_offers.sql` | F-01 make, F-02 counter (5 rounds), F-03 accept, F-04 decline reasons, F-05 withdraw, F-06 expiry sweep |
| `30_agreements.sql` | G-01 to G-08: exchange details, signing, cancel and late cancels, flag for review, notifications, operator paths |
| `40_deletion.sql` | X-02 delete own account, then own photos, X-03 can't delete anyone else, X-04 needs a sign-in from the last 10 minutes, N-02 names redacted in notifications, V-02 old name visible nowhere |
| `50_security.sql` | S-01 neighbor vs neighbor for every table and RPC, S-02 signed-out visitor |
| `60_storage.sql` | S-03 listing-photos bucket limits and folder policies |
| `70_notifications.sql` | P-06 notification preferences |
| `80_time.sql` | Z-03 24-hour late-cancel boundary, offer and listing expiry boundaries, DST (Nov 1 2026, America/Chicago), midnight UTC |

## Output

One line per check:

```
PASS  F-02 a 6th round is refused
FAIL  S-01 offers: Bob can't read Ann's rows (saw 2 row(s))
XFAIL P-06 messages off: no message notification BUG: notify() ignores notification_prefs (messages)
XPASS F-03 one listing, one agreement (marked as a known bug but it passed ...)
```

- `XFAIL` is a check that fails because of a known bug in the app's SQL. It
  doesn't fail the run. The bug is written next to the check with
  `select tests.expect_bug('<one line>');`.
- `XPASS` means a check marked as a known bug now passes: the bug was fixed.
  It fails the run on purpose. Delete the `expect_bug` line above that check.

## Running locally

Needs Postgres 16 or 17 and `psql`. Connection uses the standard libpq
variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`), defaulting to the
socket in `/var/run/postgresql` and user `postgres`. The user must be able to
create databases and roles.

On a Debian/Ubuntu machine with the packaged cluster:

```sh
sudo cp /etc/postgresql/16/main/pg_hba.conf /tmp/pg_hba.conf.bak
# set the two "local all ... peer" lines to "trust"
sudo pg_ctlcluster 16 main start
npm run test:db
# afterwards
sudo pg_ctlcluster 16 main stop
sudo cp /tmp/pg_hba.conf.bak /etc/postgresql/16/main/pg_hba.conf
```

Or with Docker:

```sh
docker run --rm -d --name bartrrr-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
PGHOST=localhost PGPASSWORD=postgres npm run test:db
```

Options:

```sh
bash supabase/tests/run.sh 20 50        # only files starting with 20_ and 50_
KEEP_DB=1 bash supabase/tests/run.sh    # keep the databases to inspect
VERBOSE=1 bash supabase/tests/run.sh    # also show warnings and psql context
```

## CI (GitHub Actions)

Not wired up yet. The settings to use:

```yaml
jobs:
  db:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16          # production runs 17 (supabase/config.toml); both work
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      PGHOST: localhost
      PGPORT: 5432
      PGUSER: postgres
      PGPASSWORD: postgres
    steps:
      - uses: actions/checkout@v4
      - run: bash supabase/tests/run.sh   # psql is preinstalled on ubuntu-latest
```

No `npm ci` is needed for this job: the runner is bash and psql only.

## Writing checks

All helpers live in the `tests` schema (`setup/10_harness.sql`):

| Helper | Passes when |
|---|---|
| `tests.as('ann' \| 'bob' \| 'cat' \| 'dan' \| 'anon' \| 'service_role' \| 'trusted')` | (switches role and JWT claims; `trusted` is postgres with no claims, like the SQL editor or pg_cron) |
| `tests.check(id, desc, condition [, why])` | condition is true |
| `tests.ok(id, desc, sql)` | the statement runs (its effects are kept) |
| `tests.err(id, desc, sql, like)` | the statement fails with a message containing `like` |
| `tests.no_effect(id, desc, sql)` | a write is refused (42501) or matches no rows; always rolled back |
| `tests.no_rows(id, desc, sql)` | a query is refused (42501) or returns nothing |

The app's functions read `now()`, which is fixed for a transaction. To test
time, set stored times relative to `now()` and act in the same transaction
(see `80_time.sql`).

**New table or RPC?** `50_security.sql` reads the catalog. A table in
`public` without a row in `tests.table_rules` (plus fixture rows for Ann), or a
function signed-in neighbors can execute without a row in `tests.rpc_rules`,
fails the run as unclassified. Add the rule and the attack statements there.

## Not covered here

- The Storage API's own enforcement of `file_size_limit` and
  `allowed_mime_types` (only the bucket settings are checked) and its path
  normalization.
- Realtime delivery, the `send-push` Edge Function, and the pg_cron schedule
  itself (pg_cron isn't in plain Postgres; the job's function is called directly).
- Listing drafts: there is no drafts table; an unposted listing exists only in
  the open Create listing page (its uploaded photos are covered by S-03).
