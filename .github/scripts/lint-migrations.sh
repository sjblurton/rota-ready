#!/usr/bin/env bash
# Usage: lint-migrations.sh [base-ref]   (default origin/main)
set -euo pipefail

migrations=apps/api/prisma/migrations
merge_base=$(git merge-base "${1:-origin/main}" HEAD)
changes=$(git diff --name-status --diff-filter=AMR "$merge_base" -- "$migrations")
untracked=$(git ls-files --others --exclude-standard -- "$migrations")

failed=0
fail() {
  echo "::error file=$1::$2"
  failed=1
}

files=()
while IFS=$'\t' read -r status path renamed; do
  file=${renamed:-$path}
  [[ $file == */migration.sql ]] || continue
  if [[ $status == M* ]]; then
    fail "$file" "This migration is already on the base branch. Don't edit an applied migration; add a new one."
  else
    files+=("$file")
  fi
done <<<"$changes"
while IFS= read -r file; do
  [[ $file == */migration.sql ]] && files+=("$file")
done <<<"$untracked"

if [ ${#files[@]} -eq 0 ] && [ "$failed" -eq 0 ]; then
  echo "No new or changed migrations to lint."
  exit 0
fi

for file in "${files[@]}"; do
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

if [ ${#files[@]} -gt 0 ]; then
  pnpm exec squawk "${files[@]}" || failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "Migrations must run atomically and work with the API that's still running (ADR-0006)."
fi
exit "$failed"
