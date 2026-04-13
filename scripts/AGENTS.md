# Scripts - AI Agent Guidelines

Scope: `scripts/**`

## Purpose

This directory owns release, artifact, and deploy automation for the frontend.

## Rules

- Preserve existing CLI flags, positional behavior, and stdout or stderr semantics unless the task explicitly changes them.
- Keep release and deploy behavior aligned with `README.md` and `docs/deploy.md`.
- Reuse helpers in `scripts/lib/**` before adding new script-local utilities.
- Add or update adjacent script tests when behavior changes.
- Avoid introducing new dependencies for scripting work unless the benefit clearly outweighs the maintenance cost.
