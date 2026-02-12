# Deployment Runbook

This document covers:
- deploying locally to a single dev/sandbox stack
- deploying locally to all stacks in a stage
- how CircleCI deploys from release tags

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

Notes:
- CLI args still work and override stage/stack values:
  - `npm run deploy:dev -- --stage=sandbox --stack=qa2`
- If `AWS_PROFILE` is already set in your shell, it takes precedence over `DEPLOY_AWS_PROFILE`.

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
3. Invalidates CloudFront if the secret contains `DistroId`

## Local Deploy: All Stacks In A Stage

Deploy every stack in a stage by omitting `--stack`:

```bash
AWS_PROFILE=<your-profile> npm run deploy -- --stage=sandbox
```

This discovers all `careops-<stage>-*` stacks (with pagination) and deploys each one.

## CircleCI Deploys

CircleCI deploy workflows run only for release tags matching:
- `vYYYYMMDD.N`

Current deploy workflows:
- `deploy-sandboxes` (stage `sandbox`)
- `deploy-prod` (stage `prod`)

Each workflow does:
1. `build` job produces `dist/`
2. `release-approval` manual approval gate
3. `deploy` job runs:
```bash
npm run deploy -- --stage=<stage>
```

## Triggering CircleCI Deploy

1. Create/push a release tag:
```bash
npm run release
```
2. Open CircleCI pipeline for that tag.
3. Approve `release-approval`.
4. CircleCI runs deploy jobs for sandbox and prod workflows.

## Troubleshooting

- `No stacks found: careops-<stage>-*`
  - Check `--stage` and `--stack` values.
  - Confirm CloudFormation stack naming convention.

- `AWS credentials not available`
  - Verify SSO login and `AWS_PROFILE`.

- `No CloudFront distribution found, skipping invalidation`
  - Expected when `DistroId` is absent from stack secret.
