import dayjs from 'dayjs';
import { Radio } from 'marionette';

import intl from 'js/i18n';
import { formatDate } from 'js/base/dayjs';
import { getInteractionSummary, getInteractionViaLabel, hasInteractionChannelHeading } from 'js/apps/patients/shared/interactions/display';

const copy = intl.patients.messaging;

export function messageTime(timestamp, full) {
  if (!timestamp) return null;
  return { datetime: timestamp, label: formatDate(dayjs(timestamp), full ? 'AT_TIME' : 'TIME') };
}

export function interactionStatus(model) {
  if (model.get('cancelled_at')) return 'cancelled';
  if (!model.get('occurred_at') && model.get('expected_at')) return 'scheduled';
  return model.get('direction') === 'inbound' ? 'received' : 'unconfirmed';
}

function sourceLinks(model) {
  const action = model.getAction();
  const flow = !action && model.getFlow();
  return {
    action: action ? { id: action.id, name: action.get('name') } : null,
    flow: flow ? { id: flow.id, name: flow.get('name') } : null,
  };
}

function nativeBody(model) {
  const body = getInteractionSummary(model);
  return typeof body === 'string' && body.trim() ? body : copy.bodyUnavailable;
}

export function cardPresentation(model, { patient }) {
  const metadata = model.get('metadata') || {};
  const inbound = model.get('direction') === 'inbound';
  const status = interactionStatus(model);
  const sender = inbound ?
    `${ patient.get('first_name') } ${ patient.get('last_name') }`.trim() :
    metadata.clinician_name || Radio.request('bootstrap', 'organization').get('name');
  return {
    kind: 'message', senderName: sender, senderKind: inbound ? 'patient' : 'team',
    viaLabel: getInteractionViaLabel(model), status,
    statusLabel: { scheduled: copy.scheduled, cancelled: copy.cancelled, unconfirmed: copy.unconfirmed }[status],
    // Native ordering is occurred_at/expected_at. A cancellation does not rewrite that order.
    time: messageTime(model.getTimestamp(), status === 'scheduled'),
    body: nativeBody(model),
    disposition: hasInteractionChannelHeading(model) ? metadata.disposition : undefined,
    directionLabel: inbound ? copy.inbound : copy.outbound,
    ...sourceLinks(model),
  };
}
