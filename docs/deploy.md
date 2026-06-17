# Deployment Runbook

This document covers:
- deploying locally to a single dev/sandbox organization
- deploying locally to all organizations in a stage
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
DEPLOY_ORGANIZATION=paul
```

Run deploy with local defaults:

```bash
npm run deploy:dev
```

Deploy QA organizations directly (no stage/organization args needed):

```bash
npm run deploy:qa
npm run deploy:qa2
```

Notes:
- CLI args still work and override stage/organization values:
  - `npm run deploy:dev -- --stage=qa --organization=qa2`
- If `AWS_PROFILE` is already set in your shell, it takes precedence over `DEPLOY_AWS_PROFILE`.
- QA app organization identifiers:
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

## Local Deploy: Single Dev Environment

Deploy a single environment by passing both `--stage` and `--organization`.

```bash
AWS_PROFILE=<your-profile> npm run deploy -- --stage=dev --organization=<organization-id>
```

Example:
```bash
AWS_PROFILE=default npm run deploy -- --stage=dev --organization=paul
```

This discovers the deploy target in CloudFormation by tags:
- `stage=<stage>`
- `organization=<organization-id>`

And then:
1. Generates `dist/appconfig.json` from Secrets Manager secret `customer/<stage>/<organization-id>`
2. Uploads `dist/` to the organization's WebsiteBucket
3. Resolves the stack's `CloudFrontDistribution` resource and invalidates CloudFront

## Local Deploy: All Organizations In A Stage

Deploy every organization in a stage by omitting `--organization`:

```bash
AWS_PROFILE=<your-profile> npm run deploy -- --stage=sandbox
```

This pages CloudFormation results, filters by the `stage=<stage>` tag, and deploys each matching environment.

## CircleCI Release Artifacts

Release artifact publishing runs only for version tags matching:
- `vYYMMDD.N`

The tag pipeline in [`.circleci/config.yml`](../.circleci/config.yml):
1. Builds `dist/`
2. Uploads sourcemaps to Datadog
3. Packages `dist/` as `/tmp/dist.tar.gz`
4. Publishes the artifact and checksum once per tag to:
   - bucket: `rw-frontend-artifacts-dev`
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
2. Downloads the tagged artifact from `rw-frontend-artifacts-dev/app-frontend/<tag>/dist.tar.gz`
3. Unpacks the artifact into `dist/`
4. Runs:
```bash
npm run deploy -- --stage=<stage> [--organization=<organization>]
```
5. Writes CircleCI deploy markers for every environment resolved from the deploy target:
   - specific targets such as `qa:qa2` write one marker for that concrete environment
   - stage-wide targets such as `qa:*`, `sandbox:*`, and `prod:*` retain the wildcard marker and also write one marker per concrete environment discovered from CloudFormation tags for that stage
   - `sandbox:*` also deploys `prod:demonstration` from the same artifact and writes a marker for that environment
   - `prod:*` excludes `prod:demonstration`; deploy it explicitly or through `sandbox:*`
   - stage-wide deploys continue through every resolved environment and fail the job at the end if any targets fail
   - if a stage-wide deploy partially succeeds, concrete environment markers reflect the per-environment outcomes while the wildcard marker reflects the overall deploy result
6. For QA deploys that include `qa2` (`qa:qa2` and `qa:*`), posts `qa2_deploy_succeeded` to `RoundingWell/app-tests`
7. Updates the Linear release stage by running the pinned `linear/linear-release` CLI (downloaded by [`scripts/download-linear-release.sh`](../scripts/download-linear-release.sh)):
   - `qa:*` and specific `qa:<organization>` deploys → `update --stage=QA`
   - `sandbox:*` and specific `sandbox:<organization>` deploys → `update --stage=Sandbox`
   - `prod:*` (wildcard only) → `update --stage=Released`, then `complete`
   - org-scoped `prod:<organization>` deploys (e.g. `prod:demonstration`, `prod:apple`) are skipped — only the wildcard prod deploy represents a release event
   - `dev` deploys are skipped
   - the step is failure-tolerant (`|| echo …`); a Linear API or download failure does not fail the deploy job

Supported deploy environments:
- `dev:<organization>`
- `dev:*`
- `qa:*`
- `sandbox:*`
- `prod:*`
- specific environments such as `dev:nick`, `qa:qa2`, `sandbox:banana`, `prod:apple`

Dev-account deploys:
- `dev:<organization>` or `dev:*`
- `qa:*`

Prod-account deploys:
- `sandbox:*` plus `prod:demonstration`
- `prod:*` excluding `prod:demonstration`

Artifact ownership:
- the release artifact is published to the dev-account bucket
- QA deploys read that bucket with the dev role
- sandbox and prod deploys read that same bucket with the prod role

Additional CircleCI secrets for the QA2 E2E dispatch step:
- `GH_APP_ID`
- `GH_APP_PRIVATE_KEY`
- `GH_APP_INSTALLATION_ID`

CircleCI context for the Linear release steps:
- `linear-secrets` context, providing `LINEAR_ACCESS_KEY` (Linear release pipeline access key)
- attached to the `release-artifact` workflow in [`.circleci/config.yml`](../.circleci/config.yml) (sync + `Started` stage on tag build), and to the `deploy-qa` and `deploy-prod` workflows in [`.circleci/deploy.yml`](../.circleci/deploy.yml). The `deploy-dev` workflow does not have access to the Linear secret.
- the Linear release pipeline is configured as **scheduled**; stages used: built-in `Started`, custom `QA` (frozen) and `Sandbox`, and built-in terminal `Released`. CI also calls `complete` after a successful prod deploy.

For QA deploys that include `qa2`, [`.circleci/deploy.yml`](../.circleci/deploy.yml) resolves the release SHA, passes the release tag, SHA, and a CircleCI run URL to [`scripts/dispatch-qa2-e2e.js`](../scripts/dispatch-qa2-e2e.js), and that script uses the GitHub App credentials above plus the `app-tests` installation id to mint a short-lived installation token before posting `repository_dispatch` with this payload:

```json
{
  "source_repo": "RoundingWell/app-frontend",
  "source_ref": "refs/tags/<release-tag>",
  "source_sha": "<release-commit-sha>",
  "source_run_url": "<circleci-build-url>",
  "organization": "qa2",
  "stage": "qa"
}
```

## Triggering A CircleCI Deploy

1. Create and push a release tag:
```bash
npm run release
```
2. Wait for the tag pipeline to publish the release artifact.
3. In CircleCI Deploy, start a deploy using:
   - `environment_name=<stage>:<organization|*>`
   - `target_version=<release-tag>`
4. The deploy pipeline downloads the artifact for that tag and deploys the target environment.
5. For stage-wide `dev:*`, `qa:*`, `sandbox:*`, and `prod:*` deploys, the pipeline also writes markers for each concrete environment it resolved for that stage so later environment-specific deploys stay visible in CircleCI Deploy.

The AWS account must expose the deploy target to run successfully:
- Secrets Manager must have a secret named `customer/<stage>/<organization>`
- CloudFormation stack must have `stage` and `organization` tags
- CloudFormation stack must have a `WebsiteBucket` output
- Non-dev CloudFormation stacks must include a `CloudFrontDistribution` resource

## Troubleshooting

- `No environments found for stage=<stage>`
  - Check `--stage` and `--organization` values.
  - Confirm the CloudFormation tags include `stage` and `organization`.

- `AWS credentials not available`
  - Local deploy: verify SSO login and `AWS_PROFILE`.
  - CircleCI deploy: verify the job assumed the expected `CircleCIRole` via `aws-cli/setup`.

- `No CloudFront distribution found for <stack>, skipping invalidation`
  - Dev deploys skip invalidation when the stack has no `CloudFrontDistribution` resource.
  - Non-dev deploys fail when CloudFront lookup or invalidation fails.
