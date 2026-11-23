#!/usr/bin/env bash
# Source this for $migrations (the migrations folder), then call find_migration_changes <base-ref>. It fills
# new_migrations (added, renamed or untracked since the merge base) and edited_migrations (on the base branch, then changed).
migrations=apps/api/prisma/migrations

find_migration_changes() {
  local merge_base changes untracked status path renamed file
  merge_base=$(git merge-base "$1" HEAD)
  changes=$(git diff --name-status --diff-filter=AMR "$merge_base" -- "$migrations")
  untracked=$(git ls-files --others --exclude-standard -- "$migrations")

  new_migrations=()
  edited_migrations=()
  while IFS=$'\t' read -r status path renamed; do
    file=${renamed:-$path}
    [[ $file == */migration.sql ]] || continue
    if [[ $status == M* ]]; then
      edited_migrations+=("$file")
    else
      new_migrations+=("$file")
    fi
  done <<<"$changes"
  while IFS= read -r file; do
    [[ $file == */migration.sql ]] && new_migrations+=("$file")
  done <<<"$untracked"
  return 0
}
