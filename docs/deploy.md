# Deployment Runbook

This document covers:
- deploying locally to a single dev/sandbox stack
- deploying locally to all stacks in a stage
- how CircleCI publishes release artifacts and deploys them

## Prerequisites

1. Use the repo Node version:
```bash
nvm use
```
2. Install dependencies:
```bash
npm ci
```
3. Build `dist`:
```bash
npm run build
```
4. Ensure AWS credentials are available.
For local runs, scripts use AWS SSO credentials (`AWS_PROFILE`, default profile if unset).
In CircleCI, AWS auth is provided via OIDC role assumption; long-lived access keys are not required.

## Local Dev Deploy Config File

Use the existing repo `.env` file and set deploy defaults:

```bash
DEPLOY_AWS_PROFILE=dev
DEPLOY_STAGE=dev
DEPLOY_STACK=paul
```

Run deploy with local defaults:

```bash
npm run deploy:dev
```

Deploy QA stacks directly (no stage/stack args needed):

```bash
npm run deploy:qa
npm run deploy:qa2
```

Notes:
- CLI args still work and override stage/stack values:
  - `npm run deploy:dev -- --stage=qa --stack=qa2`
- If `AWS_PROFILE` is already set in your shell, it takes precedence over `DEPLOY_AWS_PROFILE`.
- QA app stack names:
  - `careops-qa-quality-assurance` (`npm run deploy:qa`)
  - `careops-qa-qa2` (`npm run deploy:qa2`)

## Find Your AWS Profile

AWS profile names are defined in:
- `~/.aws/config`
- `~/.aws/credentials`

List profile section names:

```bash
grep -E '^\[.*\]$' ~/.aws/config ~/.aws/credentials
```

Typical names look like:
- `default`
- `dev`
- `localstack`

## Local Deploy: Single Dev Stack

Deploy a single stack by passing both `--stage` and `--stack`.

```bash
AWS_PROFILE=<your-profile> npm run deploy -- --stage=dev --stack=<stack-id>
```

Example:
```bash
AWS_PROFILE=default npm run deploy -- --stage=dev --stack=paul
```

This resolves CloudFormation stack:
- `careops-<stage>-<stack-id>`

And then:
1. Generates `dist/appconfig.json` from Secrets Manager secret `customer/<stage>/<stack-id>`
2. Uploads `dist/` to the stack's WebsiteBucket
3. Invalidates CloudFront if the secret contains `DistroId` or `DistroID`

## Local Deploy: All Stacks In A Stage

Deploy every stack in a stage by omitting `--stack`:

```bash
AWS_PROFILE=<your-profile> npm run deploy -- --stage=sandbox
```

This discovers all `careops-<stage>-*` stacks (with pagination) and deploys each one.

## CircleCI Release Artifacts

Release artifact publishing runs only for version tags matching:
- `vYYMMDD.N`

The tag pipeline in [`.circleci/config.yml`](../.circleci/config.yml):
1. Builds `dist/`
2. Uploads sourcemaps to Datadog
3. Packages `dist/` as `/tmp/dist.tar.gz`
4. Publishes the artifact and checksum once per tag to:
   - bucket: `rw-frontend-artifacts`
   - prefix: `app-frontend`

CircleCI assumes AWS roles via OIDC before AWS-backed steps:
- dev account: `arn:aws:iam::104566035342:role/CircleCIRole`
- prod account: `arn:aws:iam::543732963292:role/CircleCIRole`

## CircleCI Deploys

Deploys run from the published release artifact, not directly from the tag build.

The deploy pipeline in [`.circleci/deploy.yml`](../.circleci/deploy.yml):
1. Requires:
   - `pipeline.deploy.environment_name`
   - `pipeline.deploy.target_version`
2. Downloads the tagged artifact from `rw-frontend-artifacts/app-frontend/<tag>/dist.tar.gz`
3. Unpacks the artifact into `dist/`
4. Runs:
```bash
npm run deploy -- --stage=<stage> [--stack=<stack>]
```

Supported deploy environments:
- `qa:*`
- `sandbox:*`
- `prod:*`
- specific stacks such as `qa:qa2`, `sandbox:banana`, `prod:apple`

Role selection:
- `qa:*` deploys assume the dev account role
- `sandbox:*` and `prod:*` deploys assume the prod account role

## Triggering A CircleCI Deploy

1. Create and push a release tag:
```bash
npm run release
```
2. Wait for the tag pipeline to publish the release artifact.
3. In CircleCI Deploy, start a deploy using:
   - `environment_name=<stage>:<stack|*>`
   - `target_version=<release-tag>`
4. The deploy pipeline downloads the artifact for that tag and deploys only the selected target environment.

## Troubleshooting

- `No stacks found: careops-<stage>-*`
  - Check `--stage` and `--stack` values.
  - Confirm CloudFormation stack naming convention.

- `AWS credentials not available`
  - Local deploy: verify SSO login and `AWS_PROFILE`.
  - CircleCI deploy: verify the job assumed the expected `CircleCIRole` via `aws-cli/setup`.

- `No CloudFront distribution found, skipping invalidation`
  - Expected when both `DistroId` and `DistroID` are absent from stack secret.
