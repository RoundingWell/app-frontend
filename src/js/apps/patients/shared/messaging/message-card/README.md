# Message presentation adapter

`MessageCardView` accepts `interaction` (any host-owned value),
`presentInteraction(interaction)`, `currentActionId`, and translated
`labels: { sms, showMore }`. Alternatively supply an observable `model`; its
normal `change` event rerenders the card. Never replace the borrowed model in
place. Destroy/recreate the View when its interaction identity changes.

The adapter returns this **presentation-only** shape. These names do not define
wire fields and must not be added to REST requests or interaction metadata:

```js
{
  senderName: 'Demo Staff',
  senderKind: 'team', // patient => filled marker; team => outlined marker
  kind: 'message', // auto-reply => muted; consent/carrier-response => hidden
  viaLabel: 'via SMS', // auto-reply uses translated "via SMS auto-reply"
  status: 'sent',
  statusLabel: 'Sent',
  time: { datetime: '2026-11-12T09:48:00Z', label: '9:48 AM' },
  body: 'Hi Demo…',
  directionLabel: 'Outbound',
  disposition: 'Text Sent',
  action: { id: 'action-id', name: 'Message Nov 12' },
}
```

- Use `status: scheduled` and `statusLabel: Scheduled` with the actual expected
  send date/time, including any business-hours deferral. Dashed blue border.
- `sending`, `sent`, and unknown outcomes must retain distinct accurate copy.
  A sent timestamp is not delivery evidence. Only explicit delivery confirmation
  may use `delivered` and the time-only headline from DES-27.
- `failed` means permanent failure only: provide `statusLabel: Not delivered`,
  translated `reason`, and historical `destination`. Both status and reason red.
  Temporary provider retries are not permanent failures.
- `cancelled` uses `statusLabel: Cancelled`; remains visible and muted.
- `not-sent` uses `statusLabel: Not sent:` and the supplied eligibility `reason`.
- Ordinary acknowledgments use `kind: auto-reply` with their accurate via label.
  STOP/START/UNSTOP events use `kind: consent`; carrier acknowledgments use
  `kind: carrier-response`. They render no message card; the host owns filtering
  them from the collection and presenting consent through ConsentAuditView.
- Action label appears below the body only when its id differs from
  `currentActionId`. Omit currentActionId on the full timeline. Actionless items
  omit `action`. `navigate:action` emits the action id for host routing; the
  presenter does not route, send, retry, transition, group, page, or count.
- All dispositions render, including generic Text Sent and disposition-only
  cards. A truly empty message without body, disposition or failure reason is
  hidden; the sender/time headline alone does not make an empty card.
- Body keeps line breaks and escaped HTML. Only HTTP(S) URLs become links.
  Four rendered lines collapse, with Show more only on measured overflow. The
  native button supports keyboard activation; expansion survives rerender and
  resets with the View lifetime. ResizeObserver is released on detach.

The integrator owns translation registration/copy, status/time formatting,
delivery evidence mapping, live model updates, selection/grouping, and ensuring
the old renderer still handles non-SMS interactions and FE-284 dispositions.
No original Interactions modules are changed by this component.
