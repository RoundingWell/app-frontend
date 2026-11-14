import dayjs from 'dayjs';
import { get } from 'underscore';
import { Radio } from 'marionette';

import intl from 'js/i18n';
import { formatDate } from 'js/base/dayjs';
import { getInteractionSummary } from 'js/apps/patients/shared/interactions/display';
import { actorDisplayName, presentInteraction } from 'js/entities-service/messaging-prototype/contract';

const copy = intl.patients.messaging;
const STATUSES = { scheduled: 'scheduled', cancelled: 'cancelled', not_delivered: 'failed', not_sent: 'not-sent' };

export function messageTime(timestamp, full = false) {
  if (!timestamp) return null;
  return { datetime: timestamp, label: formatDate(dayjs(timestamp), full ? 'AT_TIME' : 'TIME') };
}

function reason(code) {
  return {
    opted_out: copy.optedOut,
    cannot_receive_sms: copy.cannotReceive,
    do_not_contact: copy.doNotContact,
    synthetic_provider_rejection: copy.providerRejection,
  }[code] || code;
}

function statusLabel(row) {
  if (row.status === 'not_sent') return `${ copy.notSent } ${ reason(row.reasonCode) }`;
  if (row.status === 'received' || row.status === 'delivered') return null;
  return {
    scheduled: copy.scheduled, cancelled: copy.cancelled, not_delivered: copy.notDelivered,
    not_sent: copy.notSent, unconfirmed: copy.unconfirmed,
  }[row.status] || copy.unconfirmed;
}

function senderName(model, patient) {
  if (model.get('direction') === 'inbound') return `${ patient.get('first_name') } ${ patient.get('last_name') }`.trim();
  return model.get('metadata')?.clinician_name || Radio.request('bootstrap', 'organization').get('name');
}

export function cardPresentation(model, { patient, currentActionId = null }) {
  const row = presentInteraction(model, { currentActionId });
  if (!row) return nativeCard(model, patient);
  if (row.kind === 'hidden') return { kind: 'carrier-response' };
  if (row.kind === 'consent_audit') return { kind: 'consent' };
  return fixtureCard(model, row, patient);
}

function fixtureCard(model, row, patient) {
  return {
    senderName: row.senderName || senderName(model, patient), senderKind: row.direction === 'inbound' ? 'patient' : 'team',
    kind: row.autoReply ? 'auto-reply' : 'message', viaLabel: row.autoReply ? copy.viaAutoReply : copy.viaSms,
    status: STATUSES[row.status] || row.status, statusLabel: statusLabel(row),
    time: messageTime(row.timestamp, row.status === 'scheduled'), body: row.body,
    directionLabel: row.direction === 'inbound' ? copy.inbound : copy.outbound,
    disposition: get(model.get('metadata'), 'disposition'),
    reason: cardReason(row), destination: row.recipientNumber,
    action: row.actionId ? { id: row.actionId, name: row.actionName } : null,
  };
}

function cardReason(row) {
  return row.status === 'not_sent' ? null : reason(row.reasonCode);
}

function nativeCard(model, patient) {
  const action = model.getAction();
  return {
    kind: 'message', senderName: senderName(model, patient), senderKind: model.get('direction') === 'inbound' ? 'patient' : 'team',
    viaLabel: copy.viaSms, status: 'unconfirmed', statusLabel: model.get('direction') === 'outbound' ? copy.unconfirmed : null,
    time: messageTime(model.getTimestamp()), body: getInteractionSummary(model), disposition: model.get('metadata')?.disposition,
    directionLabel: model.get('direction') === 'inbound' ? copy.inbound : copy.outbound,
    action: action ? { id: action.id, name: action.get('name') } : null,
  };
}

export function auditPresentation(model, { patient } = {}) {
  const row = presentInteraction(model);
  const audit = row.audit;
  const event = {
    opted_in: copy.optedInAudit, opted_out: copy.optedOutAudit,
    dnc_enabled: copy.dncEnabledAudit, dnc_disabled: copy.dncDisabledAudit, dnc_on: copy.dncEnabledAudit, dnc_off: copy.dncDisabledAudit,
  }[audit.event] || audit.event;
  return {
    segments: auditSegments(audit, patient, event),
    scopeLabel: audit.number ? copy.phoneNumber : copy.patientWide,
    number: audit.number, source: auditSource(audit), time: messageTime(row.timestamp, true),
  };
}

function auditActor(actor) {
  if (typeof actor === 'string') return actor;
  return actorDisplayName(actor) || '';
}

function auditSubject(audit, patient) {
  if (['patient_stop', 'patient_start', 'import'].includes(audit.source) && patient) return `${ patient.get('first_name') } ${ patient.get('last_name') }`.trim();
  return auditActor(audit.actor);
}

function auditSegments(audit, patient, event) {
  if (audit.source === 'staff' && audit.number && patient) {
    return [
      { text: auditActor(audit.actor), strong: true }, { text: ` ${ copy.recordedThat } ` },
      { text: `${ patient.get('first_name') } ${ patient.get('last_name') }`.trim(), strong: true },
      { text: ` ${ event } ${ copy.auditTo } ` },
    ];
  }
  return [{ text: auditSubject(audit, patient), strong: true }, { text: ` ${ event }${ audit.number ? ` ${ copy.auditTo } ` : '' }` }];
}

function auditSource(audit) {
  if (audit.source === 'import') return `${ copy.importedFrom } ${ audit.import_source || copy.unknownImport }`;
  return { patient_stop: copy.byTextingStop, patient_start: copy.byTextingStart, staff: null }[audit.source] || audit.import_source || (audit.source === 'staff' ? null : audit.source);
}
