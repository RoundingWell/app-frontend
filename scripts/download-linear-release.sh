#!/usr/bin/env bash
# Download and verify the linear/linear-release CLI to /tmp/linear-release.
# Single source of truth for the pinned version + sha256 used by both
# .circleci/config.yml (release-artifact workflow) and .circleci/deploy.yml
# (deploy workflows). Prints the binary path on success.

set -euo pipefail

linear_release_version="v0.7.0"
linear_release_sha256="c82e10e79ac54bfa5efff69124add2aa793d91b0d5e32c1ed56ab856eb2a7e79"
linear_release_url="https://github.com/linear/linear-release/releases/download/${linear_release_version}/linear-release-linux-x64"
linear_release_bin="${LINEAR_RELEASE_BIN:-/tmp/linear-release}"

curl -fsSL "$linear_release_url" -o "$linear_release_bin"
echo "${linear_release_sha256}  ${linear_release_bin}" | sha256sum -c -
chmod +x "$linear_release_bin"
echo "$linear_release_bin"
