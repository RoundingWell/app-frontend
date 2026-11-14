# Consent audit presentation adapter

`ConsentAuditView` accepts `interaction` and `presentAudit(interaction)` (or a
borrowed observable `model`, whose normal change rerenders). The adapter supplies
a historical snapshot, not a lookup into the patient's current number list:

```js
{
  segments: [
    { text: 'Demo Staff', strong: true },
    { text: ' (Care Navigator) recorded that Demo Patient opted out of texts' },
  ],
  scopeLabel: 'Phone number',
  number: '(615) 555-0144',
  source: 'Demographics form',
  time: { datetime: '2026-11-12T09:48:00Z', label: 'Nov 12, 2026 · 9:48 AM' },
}
```

All segments, actor/team, number, source, and timestamp labels are escaped.
`strong` is the only supported segment markup. Supply translated prose and
scopeLabel. Number changes always name the affected historical number. DNC
changes use patient-wide scopeLabel (for example "Do Not Contact · All patient
numbers") and omit number. The host must include actor/team when applicable,
STOP/START/UNSTOP or import provenance in segments/source, and original event
time. Do not derive history from remaining mobile numbers or remove history when
a phone is removed. No persistence, reversal control, action assignment, or
eligibility inference lives here. New-number defaults do not create audit rows.

The host owns event mapping, patient-wide ordering, filtering STOP/START and
carrier replies from message cards, and exposing audit rows in every capable
action's embedded timeline and the full Interactions timeline. This contract
does not choose unresolved BE-697 storage or DNC customer-field mapping.
