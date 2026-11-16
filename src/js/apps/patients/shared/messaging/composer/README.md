# Composer ownership

`ComposerView` follows the comment form's ownership: it edits a host-supplied
Backbone draft model, renders host-supplied state and emits `submit:message`.
The host handles that event. The View performs no HTTP, eligibility refresh,
interaction creation, action/state mutation or history reconciliation.

Mount it with `{ model: draft, state, focus }`. The host retains the same draft
model while replacing forms or navigating during a request. Pending and uncertain
requests belong to that owner, not to the disposable View. Dispose the owner on
logout/workspace change; never reuse its draft for another context.

`createComposerDraft({ sessionScope, patientId, actionId, initialNumberId,
initialNumberLabel })` creates a model; it is not a module-wide registry.
`sessionScope` identifies the signed-in clinician and workspace. `actionId` is
explicitly null for Interactions. Only draft text and recipient selection are
persisted in session storage. A storage failure retains the host's in-memory
model. Creating another model does not recover an in-flight request: the host
must retain its owner until the request's outcome is known.

The presentation state supplies `enabled`, `canCompose`, `disabledReason`,
`scheduled`, `recipientName`, optional `placeholderName`/`senderName`, and
`numbers` with `id`, `label`, explicit `available` and optional `reason`.
These are UI inputs, not an API schema or default consent/state policy.
Missing/disabled recipients remain selected with an explanation; no other
recipient is silently substituted. Scheduled mode hides Send and displays the
host's send-time explanation once. Input events support paste/autofill/IME;
shared textarea-flex styling sizes the editor without a keyboard-only watcher.
State updates change controls in place without replacing the textarea.

A host may use the plain `submitDraft(draft, { state, context,
refreshEligibility, submit, reconcile })` helper. The View does not call it.
`context` supplies the patient and explicit action/null; entity-service operations
translate it to a confirmed native backend contract. The helper rechecks the
original recipient after `refreshEligibility`, rejects duplicate pending or
uncertain submissions, and accepts only a confirmed `submit` result.

An eligibility-read failure occurs before `submit` and is retryable. Once
`submit` has been called, a rejection or missing confirmation is uncertain by
default and blocks resubmission. Only a host-confirmed rejection may use
`error.outcome = 'rejected'` to permit retry. This is the helper's error contract,
not a backend payload: the host must establish that no interaction was recorded
before classifying an outcome as rejected. A timeout alone cannot establish that.

A confirmation clears only the submitted revision. Edits or recipient changes
made during the request survive. An uncertain rejection preserves the draft and
blocks another send until the host authoritatively resolves that outcome.
A confirmed write followed by failed `reconcile` reports a history-refresh
failure and never resends the interaction. The helper retains no View reference,
so it can finish after the form is destroyed.

There is no mounted production composer host or write adapter. Native history is
read-only pending authoritative eligibility, configured states and consent
contracts. Generic component tests exercise these UI/owner boundaries; they do
not demonstrate a production sending workflow.
