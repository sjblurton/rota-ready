#!/usr/bin/env bash
# Usage: test-migrations.sh [base-ref]   (default origin/main)
set -euo pipefail

base_ref=${1:-origin/main}
source "$(dirname "$0")/migration-changes.sh"
find_migration_changes "$base_ref"

if [ $((${#new_migrations[@]} + ${#edited_migrations[@]})) -eq 0 ]; then
  echo "No new or changed migrations, so nothing to check against $base_ref's API."
  exit 0
fi

repo=$(git rev-parse --show-toplevel)
base=$(mktemp -d)
cleanup() {
  git -C "$repo" worktree remove --force "$base" 2>/dev/null || true
  rm -rf "$base"
  git -C "$repo" worktree prune || true
}
trap cleanup EXIT

echo "Running $base_ref's API tests against these migrations:"
printf '  %s\n' "${new_migrations[@]}" "${edited_migrations[@]}"

git worktree add --quiet --detach "$base" "$base_ref"
rm -rf "${base:?}/$migrations"
cp -R "$repo/$migrations" "$base/$migrations"
[ -f "$repo/.env" ] && cp "$repo/.env" "$base/.env"

cd "$base"
pnpm install --frozen-lockfile
pnpm --filter @rota-ready/api exec prisma generate
if ! pnpm --filter @rota-ready/api test; then
  echo "::error::$base_ref's API tests fail against these migrations, so the API still running in production would break when they're applied. Add first, and remove in a later deploy (ADR-0006)."
  exit 1
fi
echo "$base_ref's API tests pass against these migrations."
