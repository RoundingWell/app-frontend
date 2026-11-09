# 8x8 Work dialer

Set the existing `dialer` setting to `8x8`. The package mounts the Maestro Work
embed and sends its documented `startCall` message when a phone number is chosen
from the existing Call Number picker. It never reads or writes the clipboard.
The user must sign in to 8x8. The embedding domain must be whitelisted by 8x8 for
click-to-call; iframe load is not proof of login or successful dialing. This
implementation has no manual-paste fallback and does not report a call as started
until an accepted event arrives.

## Association and logging

A click captures its action and patient IDs. Only an outbound event with the same
normalized number and a start timestamp from the click through two minutes later
can use them. An accepted match retains that snapshot until termination, even
for a longer call. Without accepted, a matching termination can attach the click.
A second click while a call is active or its click intent is still pending only
opens the panel; it cannot silently change the pending call's patient.
An unsent request is discarded if another call is accepted or the frame takes
longer than that window to become ready. The user can then choose the number again.

There is no observation of the currently open action, visited-action history, or
Link this call button. Navigating elsewhere does not change a clicked association.
Incoming/manual calls are saved without action/patient IDs unless they are the
matching outbound attempt described above. Patient Jump to lookup is navigation
only, not automatic attribution. The backend accepts unassociated artifacts but
requires a patient ID before creating a patient interaction.

Maestro event IDs identify events, not calls. Accepted/terminated are correlated
using direction, normalized number, and their documented initiation timestamp.
There is no SDK command token to distinguish a manually dialed call to the same
number during the click window. This attribution remains a conservative heuristic,
not a guaranteed provider call ID. Confirm timestamp consistency with real vendor
payloads before deployment. Offered also covers searches; it never binds an action
or blocks dialing. Inbound offered provides tentative ringing/caller presentation.

Termination snapshots and clears its own state synchronously before artifact
persistence, so an older save cannot tear down a newer call. Immediate duplicate
terminated event IDs are ignored, including after the next call starts. This is
not a durable replay/deduplication store. A save failure is reported to telemetry;
there is no automatic retry or claim that it was saved.

The `8x8-call-log` values follow the existing Compassus contract: `callData`,
`report`, nullable `action_id`, and nullable `patient_id`. The event ID is the
artifact identifier. A shared schema does not establish that it equals a CSV
Call_ID, so import/dialer reconciliation still needs deployment verification.

## Embed and validation boundaries

The frame permissions and scrollable short-viewport layout are inherited from
PR #1852. The unsandboxed nested softphone needs vendor verification and a security
review; tests cannot establish microphone/login/provider interoperability.
Automated tests use synthetic events and stubbed APIs/frames, never real calls or
patient data. The shared action UI is unchanged; the only shared runtime changes
are provider loading, artifact saving, and stale patient-search cleanup.
