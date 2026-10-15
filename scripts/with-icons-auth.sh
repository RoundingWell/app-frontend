#!/bin/bash
set +x
set -euo pipefail
: "${PKG_ICONS_READ_TOKEN:?GitHub App token is required}"
unset PKG_ICONS_APP_CLIENT_ID PKG_ICONS_APP_INSTALLATION_ID PKG_ICONS_APP_PRIVATE_KEY_BASE64 PKG_ICONS_APP_PRIVATE_KEY
# Fetch only. Git credentials/configuration cannot reach lifecycle setup.
(
  export GIT_ASKPASS="$(cd "$(dirname "$0")" && pwd)/pkg-icons-askpass.sh" GIT_TERMINAL_PROMPT=0
  unset GIT_CONFIG_PARAMETERS
  count=0
  for source in https://github.com/RoundingWell/pkg-icons.git ssh://git@github.com/RoundingWell/pkg-icons.git git@github.com:RoundingWell/pkg-icons.git; do
    export "GIT_CONFIG_KEY_${count}=url.https://github.com/RoundingWell/pkg-icons.git.insteadOf" "GIT_CONFIG_VALUE_${count}=$source"
    count=$((count+1))
  done
  for key in credential.helper credential.useHttpPath http.https://github.com/.extraheader http.https://github.com/RoundingWell/pkg-icons.git.extraheader http.https://github.com/RoundingWell/pkg-icons.git/.extraheader; do
    value=''
    if [ "$key" = credential.useHttpPath ]; then value=true; fi
    export "GIT_CONFIG_KEY_${count}=$key" "GIT_CONFIG_VALUE_${count}=$value"
    count=$((count+1))
  done
  export GIT_CONFIG_COUNT="$count"
  npm ci --prefer-offline --no-audit --ignore-scripts=true
)
unset PKG_ICONS_READ_TOKEN
exec npm rebuild --foreground-scripts --ignore-scripts=false
