#!/bin/sh
set +x
case "${1-}" in
  "Username for 'https://github.com/RoundingWell/pkg-icons.git':"*)
    printf '%s\n' x-access-token ;;
  "Password for 'https://x-access-token@github.com/RoundingWell/pkg-icons.git':"*)
    test -n "${PKG_ICONS_READ_TOKEN-}" || exit 1
    printf '%s\n' "$PKG_ICONS_READ_TOKEN" ;;
  *) exit 1 ;;
esac
