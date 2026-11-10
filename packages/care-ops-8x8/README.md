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
for a longer call, unless a different accepted call replaces it. Without accepted, a matching termination can attach the click.
A click while a call is active only opens the panel. Before acceptance, a new
click replaces the pending intent and may send another dial command, matching
Five9/RingCentral and the original 8x8 implementation. There is no timed retry
block. Delayed same-number events can therefore use the most recent click's
association; this is the existing single-call trade-off.
An unsent request is discarded if another call is accepted or the frame takes
longer than that window to become ready. The user can then choose the number again.

A failed SDK event reports schema validation, not a correlated rejection of the
dial command. It invalidates any unaccepted click's action/patient IDs, while
retaining its number/time for matching. It does not erase an already accepted
association or automatically retry. A new explicit click may retry immediately. A later matched event may
therefore be logged without explicit IDs; the evaluation can still use its
validated number. See the [vendor error contract](https://developer.8x8.com/tech-partner/docs/partner-sdk-maestro-sdk-overview/#error-events).

There is no observation of the currently open action, visited-action history, or
Link this call button. Navigating elsewhere does not change a clicked association.
Incoming/manual calls are saved without action/patient IDs unless they are the
matching outbound attempt described above. Patient Jump to lookup is navigation
only, not automatic attribution. The artifact additionally supplies
`callData.patientSearchNumber`: a valid E.164 number using the same phone parser
and validity check as Jump to, or null. Existing `searchContext` remains unchanged
so extensions or other provider context are not discarded.

The companion Compassus evaluation can use this validated number with its existing
permission-scoped patient search when no explicit patient ID exists. It requires
one raw result; no result or multiple results stop evaluation. This is general
configured search, not tenant-wide exact-phone uniqueness. The resolved patient
stays in evaluation context and is not written back onto the source artifact.
Thus the artifact may retain a null patient ID while the Interaction has a patient.
Old unmatched artifacts without `patientSearchNumber` do not get this fallback;
imports and explicit patient IDs keep their existing path. Deployment and a real
persisted Interaction still need verification.

Maestro event IDs identify events, not calls. Accepted/terminated are correlated
using direction, normalized number, and their documented initiation timestamp.
There is no SDK command token to distinguish a manually dialed call to the same
number during the click window. This attribution remains a conservative heuristic,
not a guaranteed provider call ID. Confirm timestamp consistency with real vendor
payloads before deployment. Offered also covers searches; it never binds an action
or blocks dialing. Inbound offered provides tentative ringing/caller presentation.
The three phone-specific event types tolerate omitted media and reject explicit
non-phone media. This compatibility allowance is not a confirmed diagnosis of the
reported Compassus sandbox failure; real sanitized event payloads remain needed.

Like the other dialers, the panel tracks one current accepted call. A different
accepted event replaces it; there is no retained call stack or restoration of an
older call. Like Five9/RingCentral, any successful phone termination clears the
panel, timer and patient links before artifact persistence, even when its identity
does not match. A late end can therefore clear a newer call's presentation.
Strict identity matching is retained only for saved attribution and outcome;
it does not gate UI cleanup. A delayed save cannot change subsequent call UI.
Displaced calls are logged from their termination payload without retaining their
accepted/action snapshot. An unmatched termination has unknown Answered and
Last_Leg_Disposition values, not an inferred missed/unanswered outcome. The
Compassus evaluation preserves unknown made_contact for this case. Full
call-waiting/overlap support is deferred until real
embed traffic establishes the requirement. Immediate duplicate
terminated event IDs are ignored, including after the next call starts. This is
not a durable replay/deduplication store. A save failure is reported to telemetry;
there is no automatic retry or claim that it was saved.

The `8x8-call-log` values follow the existing Compassus contract: `callData`,
`report`, nullable `action_id`, and nullable `patient_id`. The event ID is the
artifact identifier. A shared schema does not establish that it equals a CSV
Call_ID, so import/dialer reconciliation still needs deployment verification.

## Embed and validation boundaries

The frame now delegates only `microphone *; speaker-selection *`, following the
[Maestro audio requirement](https://developer.8x8.com/release-notes/2026-07-03-maestro-sdk-iframe-microphone-and-speaker/).
Camera, HID, local-network-access and autoplay grants were removed. Exact nested
origins and a compatible sandbox remain unverified; wildcard audio delegation
and the unsandboxed embed still require security review. Synthetic tests verify
the configured policy, not microphone/login/provider interoperability. Removing
capabilities needs exact-build vendor testing before rollout.
Automated tests use synthetic events and stubbed APIs/frames, never real calls or
patient data. The shared action UI is unchanged; the only shared runtime changes
are provider loading, artifact saving, and stale patient-search cleanup.
