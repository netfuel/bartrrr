#!/usr/bin/env bash
# Database rules regression suite (layer 1).
#
# Builds a fresh Postgres database from supabase/migrations/0*.sql on top of
# minimal Supabase stand-ins, then runs each supabase/tests/NN_*.sql file in
# its own copy of that database. Prints one PASS / FAIL / XFAIL / XPASS line
# per check and exits non-zero on any FAIL or XPASS, or if a file aborts.
#
# Connection: standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# Defaults: the local socket in /var/run/postgresql, user postgres.
# The user must be able to create databases and roles (a superuser locally,
# the postgres user of a CI service container).
#
#   bash supabase/tests/run.sh                 # everything
#   bash supabase/tests/run.sh 20 50           # only files starting 20_ and 50_
#   KEEP_DB=1 bash supabase/tests/run.sh       # keep the databases to poke at
#   VERBOSE=1 bash supabase/tests/run.sh       # also show warnings and context

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MIGRATIONS="$REPO/supabase/migrations"

export PGHOST="${PGHOST:-/var/run/postgresql}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=notice"
export PGTZ="${PGTZ:-UTC}"   # Supabase sessions run in UTC

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
RUN_ID="$(date +%s)_$$"
PREFIX="bartrrr_test_${RUN_ID}"
TEMPLATE="${PREFIX}_tpl"
WORK="$(mktemp -d)"
CREATED_DBS=()
CREATED_ROLES=()

if [[ -t 1 ]]; then
  C_RED=$'\e[31m'; C_GREEN=$'\e[32m'; C_YELLOW=$'\e[33m'; C_DIM=$'\e[2m'; C_OFF=$'\e[0m'
else
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_DIM=''; C_OFF=''
fi

cleanup() {
  if [[ "${KEEP_DB:-}" == "1" ]]; then
    echo "${C_DIM}KEEP_DB=1: kept ${CREATED_DBS[*]:-nothing}${C_OFF}"
  else
    for db in "${CREATED_DBS[@]}"; do
      "${PSQL[@]}" -d postgres -c "drop database if exists \"$db\"" >/dev/null 2>&1 || true
    done
    for role in "${CREATED_ROLES[@]}"; do
      "${PSQL[@]}" -d postgres -c "drop role if exists \"$role\"" >/dev/null 2>&1 || true
    done
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

# psql prefixes notices with "psql:<file>:<line>: NOTICE:  "
strip() { sed -E 's/^psql:[^:]*:[0-9]+: //; s/^(NOTICE|WARNING|ERROR):  /\1: /; s/^NOTICE: //'; }

# ─── Connection and roles ───────────────────────────────────────────────────
if ! "${PSQL[@]}" -d postgres -c 'select 1' >/dev/null 2>"$WORK/conn.err"; then
  echo "${C_RED}FAIL  setup cannot connect to Postgres (PGHOST=$PGHOST PGPORT=${PGPORT:-5432} PGUSER=$PGUSER)${C_OFF}"
  cat "$WORK/conn.err"
  exit 2
fi
for role in anon authenticated service_role; do
  exists="$("${PSQL[@]}" -d postgres -Atc "select 1 from pg_roles where rolname = '$role'")"
  [[ -z "$exists" ]] && CREATED_ROLES+=("$role")
done

# ─── Template database: stand-ins, migrations, harness, fixtures ────────────
"${PSQL[@]}" -d postgres -c "create database \"$TEMPLATE\"" >/dev/null || exit 2
CREATED_DBS+=("$TEMPLATE")

setup_files=("$HERE/setup/00_supabase_stubs.sql")
while IFS= read -r f; do setup_files+=("$f"); done < <(ls "$MIGRATIONS"/0*.sql | sort)
setup_files+=("$HERE/setup/10_harness.sql" "$HERE/setup/20_fixtures.sql")

for f in "${setup_files[@]}"; do
  if ! "${PSQL[@]}" -d "$TEMPLATE" -o /dev/null -f "$f" >"$WORK/setup.log" 2>&1; then
    echo "${C_RED}FAIL  setup $(basename "$f") did not apply${C_OFF}"
    strip <"$WORK/setup.log" | grep -v '^NOTICE' | head -20
    exit 1
  fi
  [[ "${VERBOSE:-}" == "1" ]] && strip <"$WORK/setup.log" | sed "s|^|  $(basename "$f"): |"
done
echo "${C_DIM}setup: applied $(ls "$MIGRATIONS"/0*.sql | wc -l | tr -d ' ') migrations to $TEMPLATE${C_OFF}"

# ─── Test files ─────────────────────────────────────────────────────────────
files=()
for f in "$HERE"/[0-9][0-9]_*.sql; do
  name="$(basename "$f")"
  if [[ $# -gt 0 ]]; then
    keep=0
    for want in "$@"; do [[ "$name" == "$want"* ]] && keep=1; done
    [[ $keep -eq 1 ]] || continue
  fi
  files+=("$f")
done

aborted=0
: >"$WORK/all.out"
for f in "${files[@]}"; do
  name="$(basename "$f" .sql)"
  db="${PREFIX}_${name}"
  "${PSQL[@]}" -d postgres -c "create database \"$db\" template \"$TEMPLATE\"" >/dev/null || exit 2
  CREATED_DBS+=("$db")

  echo
  echo "── $name"
  (cd "$HERE" && "${PSQL[@]}" -d "$db" -o /dev/null -f "$f") >"$WORK/$name.raw" 2>&1
  status=$?
  strip <"$WORK/$name.raw" >"$WORK/$name.out"

  while IFS= read -r line; do
    case "$line" in
      "PASS  "*)  echo "${C_GREEN}${line}${C_OFF}" ;;
      "FAIL  "*)  echo "${C_RED}${line}${C_OFF}" ;;
      "XFAIL "*)  echo "${C_YELLOW}${line}${C_OFF}" ;;
      "XPASS "*)  echo "${C_RED}${line}${C_OFF}" ;;
      "ERROR: "*) echo "${C_RED}${line}${C_OFF}" ;;
      *)          [[ "${VERBOSE:-}" == "1" ]] && echo "${C_DIM}  ${line}${C_OFF}" ;;
    esac
  done <"$WORK/$name.out"
  grep -E '^(PASS|FAIL|XFAIL|XPASS) ' "$WORK/$name.out" >>"$WORK/all.out"

  if [[ $status -ne 0 ]]; then
    aborted=$((aborted + 1))
    echo "${C_RED}FAIL  $name aborted (psql exit $status): $(grep -m1 '^ERROR' "$WORK/$name.out")${C_OFF}"
  fi
done

pass=$(grep -c '^PASS ' "$WORK/all.out")
fail=$(grep -c '^FAIL ' "$WORK/all.out")
xfail=$(grep -c '^XFAIL ' "$WORK/all.out")
xpass=$(grep -c '^XPASS ' "$WORK/all.out")

echo
echo "────────────────────────────────────────"
echo "db tests: $pass passed, $xfail expected failures (known bugs), $fail failed, $xpass unexpectedly passed, $aborted files aborted"

if [[ $fail -gt 0 || $xpass -gt 0 || $aborted -gt 0 || $((pass + xfail)) -eq 0 ]]; then
  exit 1
fi
exit 0
