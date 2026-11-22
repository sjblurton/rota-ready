#!/usr/bin/env bash
# Usage: check-shadcn-untouched.sh <base-ref>
set -euo pipefail

changed=$(git diff --name-only --diff-filter=M "$1"...HEAD -- apps/web/src/components/ui)
if [ -n "$changed" ]; then
  echo "::error::These shadcn components were edited:"
  echo "$changed"
  echo "Keep them as shadcn CLI output: change a theme token or pass className where they're used (docs/building-ui.md)."
  echo "If this is a CLI upgrade (pnpm dlx shadcn@latest add <name> --overwrite), add the shadcn-upgrade label to the PR."
  exit 1
fi
