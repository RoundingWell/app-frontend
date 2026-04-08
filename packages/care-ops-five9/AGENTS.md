# Five9 Package - AI Agent Guidelines

Scope: `packages/care-ops-five9/**`

## Purpose

This package wraps the Five9 CRM SDK for use in the frontend.

## Rules

- Treat `sdk/five9.crm.sdk.js` as downloaded vendor code with a local patch. Do not hand-edit it for routine changes.
- Use `update-sdk.js` to refresh the SDK and regenerate `sdk/index.js`.
- Keep the package entry points stable unless the task explicitly changes the public API.
- If you change the SDK update flow or wrapper behavior, update `packages/care-ops-five9/README.md` in the same patch.
