# Test Overlay

Applies when a task touches `test/**`, Cypress specs, colocated Vitest suites under `src/**/*.test.js`, or coverage tooling under `test/unit/**`.

## Coverage Contract

- The merged coverage report is the contract for this repo. Treat `.nyc_output/merged.json` as the source of truth.
- Combined Cypress and Vitest coverage is a union merge.
- Baseline coverage is `100%` for statements, functions, lines, and branches unless code is explicitly ignored.
- Do not add or widen `istanbul ignore` comments to make the gate pass unless the uncovered code is genuinely non-executable or generated and the reason is documented in the same patch.

## Required Validation

- Run `npm run coverage` before claiming a test or coverage-sensitive change is complete.
- Run `npm run coverage:check:baseline` to verify repo-wide merged coverage stays at `100%` through `nyc check-coverage`.
- Never claim coverage is preserved unless those commands actually ran.

## Test Migration Rules

- Keep browser-behavior tests in Cypress when the value is DOM rendering, focus, keyboard interaction, overlays, routing, or iframe behavior.
- Put Vitest tests next to the source file they cover as `*.test.js`.
- Move pure logic, service, and jsdom-safe view behavior to Vitest only when coverage parity is preserved in the same patch.
- When replacing a Cypress spec with a Vitest suite, preserve branch coverage, not just happy-path assertions.
- Treat flake fixes and coverage-expansion changes as separate commits when they are not required for the migration itself.
