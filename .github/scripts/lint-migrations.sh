#!/usr/bin/env bash
# Usage: lint-migrations.sh [base-ref]   (default origin/main)
set -euo pipefail

source "$(dirname "$0")/migration-changes.sh"
find_migration_changes "${1:-origin/main}"

failed=0
fail() {
  echo "::error file=$1::$2"
  failed=1
}

for file in "${edited_migrations[@]}"; do
  fail "$file" "This migration is already on the base branch. Don't edit an applied migration; add a new one."
done
if [ ${#new_migrations[@]} -eq 0 ] && [ "$failed" -eq 0 ]; then
  echo "No new or changed migrations to lint."
  exit 0
fi

for file in "${new_migrations[@]}"; do
  mapfile -t lines < <(sed -E 's/\r$//; s/[[:space:]]+$//' "$file" | grep -vE '^[[:space:]]*(--|$)' || true)
  if [ ${#lines[@]} -lt 3 ]; then
    fail "$file" "Wrap the migration in BEGIN; SET LOCAL lock_timeout = '5s'; … COMMIT; so it runs atomically."
    continue
  fi
  grep -qiE '^BEGIN;$' <<<"${lines[0]}" ||
    fail "$file" "The first statement must be BEGIN; so the migration runs atomically."
  grep -qiE "^SET LOCAL lock_timeout = '5s';$" <<<"${lines[1]}" ||
    fail "$file" "The second statement must be SET LOCAL lock_timeout = '5s'; so a blocked migration gives up instead of stalling the app."
  grep -qiE '^COMMIT;$' <<<"${lines[-1]}" ||
    fail "$file" "The last statement must be COMMIT;"
  if grep -q 'squawk-ignore-file' "$file"; then
    fail "$file" "File-wide squawk-ignore-file isn't allowed. Put -- squawk-ignore <rule> above the one statement instead."
  fi
done

if [ ${#new_migrations[@]} -gt 0 ]; then
  pnpm exec squawk "${new_migrations[@]}" || failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "Migrations must run atomically and work with the API that's still running (ADR-0006)."
fi
exit "$failed"
