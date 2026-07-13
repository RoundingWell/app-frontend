#!/usr/bin/env bash

set -euo pipefail

readonly defer_label='ci:defer-cypress'
readonly output_path="${1:-/tmp/pipeline-parameters.json}"

defer_cypress=false

# Develop, tag, release, and scheduled pipelines must retain their existing
# behavior. Feature-branch pipelines consult the open PR associated with the
# exact commit so a new revision cannot reuse an approval from an older SHA.
if [[ -n "${CIRCLE_BRANCH:-}" && "${CIRCLE_BRANCH}" != 'develop' && -z "${CIRCLE_TAG:-}" ]]; then
  response_file="$(mktemp)"
  api_root="${GITHUB_API_URL:-https://api.github.com}"
  api_url="${api_root%/}/repos/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/commits/${CIRCLE_SHA1}/pulls"

  if curl \
    --fail \
    --silent \
    --show-error \
    --retry 3 \
    --header 'Accept: application/vnd.github+json' \
    --header 'X-GitHub-Api-Version: 2022-11-28' \
    --header 'User-Agent: app-frontend-circleci' \
    --output "${response_file}" \
    "${api_url}"; then
    defer_cypress="$(
      jq \
        --arg label_name "${defer_label}" \
        'any(.[]; .state == "open" and any(.labels[]?; .name == $label_name))' \
        "${response_file}"
    )"
  else
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
