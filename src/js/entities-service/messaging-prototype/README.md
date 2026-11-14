# Isolated Messaging preview adapter

This adapter exercises FE-280 / FE-281 against an existing record-only sandbox
API while BE-696–701 and the Messaging designs remain under review. It is not a
production Messaging API contract. The card, audit and composer views have their
own presentation/host interfaces; fixture metadata stays behind this adapter.

## Activation and private bindings

Ordinary builds have no enabled prototype patients. A sandbox operator can build
with `MESSAGING_PROTOTYPE_BINDINGS_FILE=/absolute/private/bindings.json`.
The JSON contains `hostname`, `stage` (development only), `organization`,
`namespace`, `legacyNamespace`, `workspaceId`, `patientIds`, and `writablePatientId`. The writable
ID must occur in the explicit patient allowlist. Keep this file outside source
control; persisted sandbox patient/action/workspace IDs are not shipped in this
repository. The exact privately supplied hostname, development stage and organization checks also apply.
No new runtime appconfig key or URL flag is required.

Test builds use unrelated local interception identities from
`test/support/messaging-bindings.js`. `_TEST_` localhost activation and those test
bindings are excluded from ordinary production builds. Never deploy a test build.
The existing deployed sandbox build is a separate rollback artifact; publishing
this source does not change that environment or its backend/configuration.

## Native transport and boundaries

- `action.options.embed = compose` is the sole message-action intent. Every
  capable action reads patient-wide SMS/audit context. Native action relationships,
  message ownership, inbound routing and action-local counts remain distinct.
- Interactions sends omit action/flow relationships and never create, join or
  transition an action. The action host explicitly supplies its action instead.
- The versioned `prototype_messaging` patient field supplies recipient eligibility,
  configured native-state projections, counts/latest and revisioned consent/DNC
  intents. Missing projections are unknown/read-only, never fabricated zero.
- Read-only action hydration supplements the native standalone-only patient action
  list with context-listed IDs, verifies patient relationships, and preserves
  current-state, compose flag, Done and pending-schedule restrictions.
- New outbound records contain only `metadata.prototype_fixture`, omitting BOTH
  native SMS transport keys. The sandbox backend must retain its no-op boundary.
  Delivery remains unconfirmed unless explicit illustrative fixture evidence says
  otherwise. New staff attribution is the authenticated actor snapshot, never an
  invented clinician title. Historical records are not rewritten.
- Consent controls use typed, revisioned operations and the authoritative field
  resource ID. They do not choose a production default-consent or DNC mapping.
  Carrier STOP, staff changes and imports retain their explicit provenance.
- All requests use the existing authenticated entity layer. Mutation preflight
  reads fresh eligibility. Display reads share only overlapping context requests;
  consumer cancellation, notification generation and session scope remain explicit.
- Persisted POST confirmations reconcile without waiting for the writer's excluded
  websocket echo. Failed/uncertain writes are not retried automatically. A failed
  history refresh never reclassifies a persisted text as unsent.

## Reading and layout

One bounded action scroller contains patient-wide past plus only this action's
future pending texts. The composer remains reachable below it and Activity stays
separate. Older visible windows preserve their anchor; Latest reaches the newest
conversation. Full Interactions filtering and native source links are retained.
Drafts survive navigation/resize; ordinary refresh does not recreate a focused
editor. Explicit eligibility changes disable it immediately. A failed startup's
resources are released with the owning shell, including stopped applications.

The finite action fixture scans raw ten-row pages with a maximum of 30 requests,
then reveals cached visible windows. This is NOT network-on-scroll or an atomic
snapshot. Cancelled rows need cancellation-time display order although the native
cursor uses effective expected/occurred time. An incomplete scan fails visibly.
Connected Interactions reconciliation preserves contiguous cursor coverage and
uses the same bounded-progress/error rules for local sends and unloaded frames.

## Review and rollout limits

No automatic state/owner routing, business-hour calculator, close timer, emergency
reply, failure reopening, manual flow moving or unresolved open-state cancellation
policy is introduced. Queued is not assumed Scheduled; native labels stay native.
Production delivery/consent/count/latest and Activity provenance contracts remain
open. Do not infer completed backend workflows from illustrative display states.

Tests use intercepted synthetic data and do not send SMS or mutate a live API.
Keep local/CI results separate from live acceptance and aggregate coverage.
Deployments and live verification belong to the sandbox runtime owner. Preserve
its authoritative appconfig and paired API/context rollback constraints; this PR
never deploys, seeds, changes permissions or updates another environment.
