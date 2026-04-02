# RingCX Embeddable Example Package

This package shows what a RingCX integration would look like in the same shape as the existing dialer packages, but using the RingCX Embeddable iframe and documented `postMessage` transport.

## What it implements

- `init(options)` to mount the RingCX panel in a Marionette region
- `call(number, action)` to queue and send a documented `rc-ev-clickToDial` message
- Service registration on the documented `rc-ev-init` event
- Request handlers for:
  - `rc-ev-logCall`
  - `rc-ev-matchContacts`
  - `rc-ev-matchCallLogs`
  - `rc-ev-viewLead`
- Push event listeners for:
  - `rc-ev-ringCall`
  - `rc-ev-newCall`
  - `rc-ev-endCall`
- Preserves the full RingCX `rc-ev-logCall` payload so callers can read `task.dispositionId` and `task.notes`
- Keeps the ended-call UI visible until the RingCX `rc-ev-logCall` request arrives with disposition data
- Marks transferred calls when `call.session.transferSessions[call.session.sessionId]` is present in the RingCX call payload

## Usage

```javascript
import { init, call } from '@roundingwell/care-ops-ringcx';

init({
  region,
  widgetUrl: 'https://cdn.labs.ringcentral.com/ringcx-embeddable/1.0.0/app.html',
  serviceName: 'CareOps',
  onCallLog(callLog, { actionId }) {
    console.log('log call', actionId, callLog.task.dispositionId, callLog.task.notes);
  },
  onTransferredCall(call) {
    console.log('transferred call', call.session.transferSessions[call.session.sessionId]);
  },
  onMatchContacts(queries) {
    return {};
  },
  onMatchCallLogs(queries) {
    return {};
  },
  onViewLead(lead) {
    console.log('view lead', lead);
  },
});

call('+16599999999', { id: 'action-123' });
```

## Notes

- This package uses the iframe/message-transport path from the RingCX docs, not the `RCAdapter` global.
- The callback hooks are intentionally app-specific extension points. RingCX documents the request names and transport shape, but not your CRM's storage model.
- The default widget URL matches the current RingCX Embeddable 1.0.0 beta README.
- The earlier `app-frontend` RingCentral PR got stuck because it modeled state off `rc-call-end-notify` and had no verified disposition-complete signal. This example uses the RingCX `rc-ev-logCall` request, whose source payload includes `task.dispositionId` and `task.notes`.
- RingCX exposes transfer state in call/session data, but the public parent-to-widget message types do not expose a documented transfer command. This package can detect transferred calls; it does not claim to initiate transfers from the outer app UI.

## Sources

- https://github.com/ringcentral/engage-voice-embeddable
- https://github.com/ringcentral/engage-voice-embeddable/blob/1.x/docs/api.md
- https://github.com/ringcentral/engage-voice-embeddable/blob/1.x/docs/message-transport.md
- https://github.com/ringcentral/engage-voice-embeddable/blob/1.x/docs/call-events.md
