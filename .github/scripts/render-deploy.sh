#!/usr/bin/env bash
# Usage: render-deploy.sh <deploy-hook-url> <service-id>
# Triggers a Render deploy of $GITHUB_SHA and waits until it is live or has failed.
set -euo pipefail

hook="$1"
service="$2"
sha="${GITHUB_SHA:?GITHUB_SHA is not set}"
: "${RENDER_API_KEY:?RENDER_API_KEY is not set}"
timeout_seconds="${DEPLOY_TIMEOUT_SECONDS:-1200}"

# A minute of slack so clock skew can't hide our deploy; older deploys of the
# same commit (from a re-run) are still excluded.
since=$(date -u -d '-60 seconds' +%Y-%m-%dT%H:%M:%SZ)
deadline=$(( $(date +%s) + timeout_seconds ))

curl --fail-with-body --silent --show-error --output /dev/null --request POST "$hook&ref=$sha"
echo "Triggered a deploy of $sha on $service"

while :; do
  status=$(
    curl --fail --silent --show-error \
      --header "Authorization: Bearer $RENDER_API_KEY" \
      --header 'Accept: application/json' \
      "https://api.render.com/v1/services/$service/deploys?limit=20" |
      jq -r --arg sha "$sha" --arg since "$since" \
        '[.[].deploy | select(.commit.id == $sha and .createdAt >= $since)] | first | .status // "not_found"'
  )
  case "$status" in
    live)
      echo "$service is live at $sha"
      exit 0
      ;;
    build_failed | update_failed | pre_deploy_failed | canceled | deactivated)
      echo "::error::Render deploy of $sha on $service ended as $status"
      exit 1
      ;;
  esac
  if (( $(date +%s) >= deadline )); then
    echo "::error::Timed out waiting for $service to deploy $sha (last status: $status)"
    exit 1
  fi
  echo "Waiting for $service: $status"
  sleep 15
done
