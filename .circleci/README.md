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
