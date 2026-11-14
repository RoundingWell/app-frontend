# Messaging composer host adapter

This is a UI contract, **not an API payload schema**. The host translates the
confirmed backend contract in the entity-service layer. This component performs
no HTTP, websocket, action creation, action reuse, flow assignment, status patch,
schedule change, or consent mutation.

Mount `ComposerView` with `{ adapter, patientId, actionId, sessionScope, focus }`.
`actionId` must be explicit: `null` for Interactions, or the action host's ID.
`sessionScope` must identify the signed-in clinician and workspace. Drafts are
keyed by this scope, patient and action, in memory and session storage. Pending
requests remain guarded across View replacement within the application session.
The host disposes its subscriptions on logout and supplies a new session scope.

The host recognizes `action.options.embed === 'compose'` and decides where to
mount the composer. Hosts own state, done and schedule meanings. No state IDs or
customer consent rules are inferred here.

The adapter supplies:

* `sessionScope` and `initialNumberId` (the host's initial recipient choice).
* `state`: a live Backbone Model with `enabled` (workspace flag), `canCompose`,
  `disabledReason`, `scheduled`, `recipientName` and `numbers`. Each UI number
  has `id`, `label`, `available` and `reason`. Availability must be explicitly
  `true`. The host includes opt-out, carrier STOP, DNC and other eligibility
  reasons here; it refreshes this state while the composer is open. For scheduled
  mode it supplies the formatted send time in `disabledReason`; for done mode
  it supplies the done explanation. Scheduled mode hides Send entirely.
* `refreshEligibility(submission)`: asynchronously refresh authoritative
  eligibility into `state` before each submission. Rejection prevents submission.
  The component rechecks the originally selected number after this await.
* `submit(submission)`: resolves to a truthy opaque confirmation only after the
  POST is confirmed; rejects on failure. The UI envelope contains only
  `{ patientId, actionId, numberId, body }`. Actionless wire writes must omit
  action and flow relationships, even though the UI envelope has `actionId:null`.
  The host owns transport idempotency and uncertain HTTP outcomes.
* `reconcile(confirmation, submission)`: reconcile the confirmed own POST into
  canonical history even if the View was destroyed. A reconciliation failure is
  reported as a history-refresh failure; it never offers to resend the same text.

Text stays editable during a pending request. A successful confirmation clears
only the submitted revision; any later edit or recipient change preserves the
newer draft. Failure preserves the draft. Removing/disabling a selected number
keeps it selected and explains why; no replacement recipient is chosen.

The current Interactions host creates the record-only adapter only when private
sandbox bindings match. Without that binding it mounts no composer. A confirmed
local POST reconciles through the native connected-window reader without relying
on an own-client websocket echo or automatically jumping an older reading window.
`focusComposer()` handles the native sidebar entry; drafts remain session-owned.
An outgoing View has no late UI effects. There is no global adapter-factory hook
or unconfigured production send path.

Pending upstream decisions: BE-697 consent/DNC storage and refresh mapping;
BE-700 configured composition/scheduled meanings. Do not map illustrative
ticket payload fields directly. Action-page scrolling follows the current integrated conversation layout; this
component leaves history/window ownership with the host.
