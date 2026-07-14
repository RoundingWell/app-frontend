#!/usr/bin/env bash

set -euo pipefail

readonly defer_label='ci:defer-cypress'
readonly output_path="${1:-/tmp/pipeline-parameters.json}"
readonly label_attempts=8
readonly label_poll_seconds=2

defer_cypress=false

# Develop, tag, release, and scheduled pipelines must retain their existing
# behavior. Feature-branch pipelines consult the open PR associated with the
# exact commit so a new revision cannot reuse an approval from an older SHA.
if [[ -n "${CIRCLE_BRANCH:-}" && "${CIRCLE_BRANCH}" != 'develop' && -z "${CIRCLE_TAG:-}" ]]; then
  response_file="$(mktemp)"
  api_root="${GITHUB_API_URL:-https://api.github.com}"
  api_url="${api_root%/}/repos/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/commits/${CIRCLE_SHA1}/pulls"

  api_read_succeeded=false

  for ((attempt = 1; attempt <= label_attempts; attempt += 1)); do
    if ! curl \
      --fail \
      --silent \
      --show-error \
      --connect-timeout 5 \
      --max-time 15 \
      --retry 3 \
      --retry-max-time 15 \
      --header 'Accept: application/vnd.github+json' \
      --header 'X-GitHub-Api-Version: 2022-11-28' \
      --header 'User-Agent: app-frontend-circleci' \
      --output "${response_file}" \
      "${api_url}"; then
      break
    fi

    api_read_succeeded=true
    if ! defer_cypress="$(
      jq \
        --arg label_name "${defer_label}" \
        'any(.[]; .state == "open" and any(.labels[]?; .name == $label_name))' \
        "${response_file}"
    )"; then
      api_read_succeeded=false
      defer_cypress=false
      break
    fi

    if [[ "${defer_cypress}" == 'true' ]]; then
      break
    fi

    # A PR-created pipeline can start before automation attaches its labels.
    # Only poll for new PRs so ordinary pushes to older human PRs are not delayed.
    if ! should_poll="$(
      jq \
        '([.[] | select(.state == "open")] as $open_prs |
          ($open_prs | length) > 0 and
          any($open_prs[]; (.created_at | fromdateiso8601) > (now - 120)))' \
        "${response_file}"
    )"; then
      api_read_succeeded=false
      break
    fi

    if [[ "${should_poll}" != 'true' || "${attempt}" == "${label_attempts}" ]]; then
      break
    fi

    echo "Waiting briefly for ${defer_label} to be attached to the new PR."
    sleep "${label_poll_seconds}"
  done

  if [[ "${api_read_succeeded}" != 'true' ]]; then
    echo 'Unable to read PR labels; running Cypress by default.' >&2
  fi

  rm -f "${response_file}"
fi

jq --null-input \
  --argjson defer_cypress "${defer_cypress}" \
  '{defer_cypress: $defer_cypress}' > "${output_path}"

if [[ "${defer_cypress}" == 'true' ]]; then
  echo "${defer_label} found; Cypress will wait for approval."
else
  echo 'Cypress will run automatically.'
fi
