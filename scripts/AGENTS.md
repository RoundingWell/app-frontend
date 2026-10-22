# Scripts - AI Agent Guidelines

Scope: `scripts/**`

## Purpose

This directory owns release, artifact, and deploy automation for the frontend.

## Rules

- Preserve existing CLI flags, positional behavior, and stdout or stderr semantics unless the task explicitly changes them.
- Keep release and deploy behavior aligned with `README.md` and `docs/deploy.md`.
- Reuse helpers in `scripts/lib/**` before adding new script-local utilities.
- Add or update adjacent script tests when behavior changes, and run those tests after updating them. For Cypress runners or coverage collection, also read [the validation policy](../AGENTS.md#validation) and [test evidence guidance](../test/README.md).
- Maintainer-approved exception: for changes to the small explicit `setup-agent-skills.js` helper, use one-time scratch checks of clean/repeated setup and conflict/redirect refusal, plus `npm exec -- eslint scripts/setup-agent-skills.js --max-warnings=0`. Do not add a dedicated test suite or CI wiring for this helper. Other scripts retain the adjacent-test requirement.
- Avoid introducing new dependencies for scripting work unless the benefit clearly outweighs the maintenance cost.
