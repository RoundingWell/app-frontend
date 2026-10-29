# CircleCI Pipelines

The project uses three active GitHub App pipeline definitions with separate
responsibilities:

- `CI` uses the GitHub App integration and
  [`.circleci/config.yml`](config.yml). It runs for pull requests, default-branch
  pushes, and tags. The setup config detects `ci:defer-cypress`, then continues
  into [`.circleci/workflows.yml`](workflows.yml).
- `nightly-cypress` uses the GitHub App integration and loads
  [`.circleci/workflows.yml`](workflows.yml) directly. Its `nightly-cypress`
  schedule runs the cross-browser Cypress matrix on `develop` at `0 11 * * *`.
- `deploy` uses the GitHub App integration and
  [`.circleci/deploy.yml`](deploy.yml). It has no GitHub event trigger; releases
  invoke it manually or through the CircleCI API.

GitHub App pipelines use HTTPS checkout through the installed app; they do not
require a project SSH checkout key. The old `app-frontend` OAuth definition has
no event trigger. Use `CI` when manually running pull request checks.

`workflows.yml` is shared so pull request, branch, tag, and nightly jobs reuse
the same commands and executors. `pipeline.trigger_source` selects either the
normal `test-build` workflow or the scheduled `test-nightly` workflow.

When a config path or pipeline definition changes, merge the checked-in config
first, then update CircleCI Project Setup. Keep the existing schedule active
until its replacement is configured, and remove the old schedule only after the
new pipeline has produced a successful nightly run.

## Cypress workers and coverage

Primary component and E2E jobs explicitly run Chrome. The nightly matrix keeps
Chrome, Firefox, and Edge for both suites. All use the pinned `cypress/browsers`
image in `workflows.yml`, which includes the browser executables and Firefox's
geckodriver; a plain Node image cannot satisfy these browser selections.

The current image provides Node 24.22.1, Chrome 156, Firefox 159, and Edge 156 on
Linux amd64. Keep its Node minor aligned with `.nvmrc` and the `cimg/node` pins in
both `workflows.yml` and `deploy.yml`: dependency installation checks that match.
When updating the image, check the actual browser versions and Cypress's
[supported browser range](https://docs.cypress.io/app/references/launching-browsers#browser-versions-supported),
then validate both component and E2E runs across the nightly browser matrix.
Image availability and version checks alone do not establish passing suites.

Component jobs use four workers without Cypress Cloud recording. The
`scripts/run-component-shard.js` runner assigns each spec to exactly one worker,
balancing total file size as a simple runtime proxy. Local component runs remain
single-process. E2E jobs retain their existing Cypress Cloud parallelization.

Headless Cypress collects coverage throughout the run and generates reports once
at completion. In coverage-uploading CI jobs, each worker must produce a nonempty LCOV report and successfully
upload it to Coveralls with a unique suite/worker flag. The existing Coveralls
finalizer waits for both complete jobs, including all their workers, before
finishing the combined coverage build. Nightly component workers set
`upload_coverage: false` and do not participate in that finalizer.
