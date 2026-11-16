# Native interaction history

Messages are `interactions`, not a separate entity. This app reads the existing
patient interactions endpoint with native `CHANNEL_GROUPS.messages` channels
(`sms,email,mail,fax,portal`), native UUID cursors,
and `include=action.flow,flow`. It neither reads a fixture field nor constructs
synthetic metadata.

Visibility requires the organization `messaging_enabled` setting and an enabled
workspace (defaulting to the organization setting when absent). A clinician
setting cannot override a disabled organization. Embedded history also requires
`action.options.embed === 'compose'`; action state does not limit reading history.

Past messages belong to the patient-wide reader. Only pending future messages on this
specific action are included here; the full Interactions page keeps every
scheduled message. Ownership and source links remain native. No count or latest
summary is derived from the loaded page.

Older loading follows the last raw server cursor, even across hidden-only pages.
Server page size is ten. A scan is bounded to the pages needed for the already
loaded identities plus thirty requests of headroom, and fails visibly if it
cannot finish. Refresh covers previously loaded identities before
replacing the window and retains the reading anchor. Exhaustion with unseen
loaded identities retains the previous window and reports a refresh error;
only confirmed deletion events release those identities during a read. Deleted rows do not change
the raw response count/cursor. Ordering follows native occurred/expected time and
UUID, including cancelled records; it does not pretend the API sorts by the
cancellation timestamp.

Existing Interactions display helpers supply content and channel-specific via
labels. SMS uses `metadata.body` inbound and `metadata.message` outbound, with
the existing note fallback; email, mail, fax and portal use `metadata.note`. Missing content stays identifiable. Cancellation
and scheduling use native timestamps. A recorded outbound text is delivery
unconfirmed: sent identifiers/timestamps are not delivery receipts. Missing staff
attribution uses the organization fallback, never the current user or action
owner.

There is no production write adapter here. Sending, consent/DNC editing,
configured composer states, exact action counts/latest previews, receipt status
and automatic reply/audit classification await their authoritative contracts.
The generic form uses host-owned draft and request state. Its host-side helper
preserves pending/uncertain outcomes for a future authoritative sending host;
this reader cannot issue an SMS POST.
