import { contains, filter, get, map } from 'underscore';

// Replaceable dev fixture contract. These are not production Messaging fields.
export const NAMESPACE = _MESSAGING_BINDINGS_.namespace;
export const FIELD_NAME = 'prototype_messaging';
export const WORKSPACE_ID = _MESSAGING_BINDINGS_.workspaceId;
export const CONTRACT_PATIENT_ID = _MESSAGING_BINDINGS_.writablePatientId;
export const PATIENT_IDS = _MESSAGING_BINDINGS_.patientIds;

export function isPrototypeTarget({ hostname, stage, organization, workspaceId, patientId }) {
  return hostname === _MESSAGING_BINDINGS_.hostname && stage === _MESSAGING_BINDINGS_.stage && organization === _MESSAGING_BINDINGS_.organization
    && workspaceId === WORKSPACE_ID && contains(PATIENT_IDS, patientId);
}

export function isFixture(value) {
  return value?.synthetic === true && value.contract_version === 1 && value.namespace === NAMESPACE;
}

export function isMessageAction(action, patientId) {
  return action?.get('options')?.embed === 'compose' && action.get('_patient')?.id === patientId;
}

export function readContext(value, patientId) {
  if (!isFixture(value)) throw new Error('Messaging fixture context is missing or unsupported.');
  if (patientId && value.patient_id !== patientId) throw new Error('Messaging context belongs to another patient.');
  return value;
}

function recipient(value, dnc) {
  const eligible = !dnc && value.eligible === true && !!value.number;
  return {
    number: value.number,
    label: value.label,
    state: value.state,
    eligible,
    disabledReason: dnc ? 'do_not_contact' : value.disabled_reason,
    source: value.source,
    changedAt: value.source?.changed_at,
    staffChangeAllowed: value.staff_change_allowed === true,
  };
}

function actionComposer(context, action, patientId) {
  if (!isMessageAction(action, patientId)) return { disabled_reason: 'not_message_action' };
  const projection = context.actions?.[action.id];
  if (!hasCurrentState(projection, action)) return { disabled_reason: 'refresh_required' };
  if (get(action.getState(), ['attributes', 'status']) === 'done') return { disabled_reason: 'action_done' };
  if (get(projection, ['composer', 'scheduled_interaction_id'])) return { ...projection.composer, enabled: false, disabled_reason: 'scheduled' };
  return projection.composer;
}

function hasCurrentState(projection, action) {
  const stateId = get(action.attributes, ['_state', 'id']);
  return !!stateId && get(projection, 'state_id') === stateId;
}

export function composerContext({ value, patientId, action = null }) {
  const context = readContext(value, patientId);
  const recipients = map(context.recipients, item => recipient(item, context.dnc === true));
  const policy = action ? actionComposer(context, action, patientId) : context.interactions_composer;
  const hasRecipient = !!filter(recipients, 'eligible').length;
  const disabledReason = composerDisabledReason(context, policy, hasRecipient);
  const actionId = get(action, 'id', null);
  return {
    patientId,
    actionId,
    recipients,
    enabled: disabledReason === null,
    disabledReason,
    scheduledInteractionId: get(policy, 'scheduled_interaction_id', null),
    draftKey: `${ patientId }:${ actionId || 'interactions' }`,
  };
}

function composerDisabledReason(context, policy, hasRecipient) {
  if (context.messaging_enabled !== true) return 'messaging_disabled';
  if (context.dnc === true) return 'do_not_contact';
  if (!hasRecipient) return 'no_eligible_mobile';
  if (policy?.enabled !== true) return policy?.disabled_reason || 'unavailable';
  return null;
}

export function actionSummary(value, actionId) {
  const projection = readContext(value).actions?.[actionId];
  if (!Number.isInteger(projection?.message_count) || projection.message_count < 0) return null;
  return {
    messageCount: projection.message_count,
    latestText: projection.latest_text ?? null,
    latestInteractionId: projection.latest_interaction_id ?? null,
  };
}

function messageStatus(model, fixture) {
  if (model.get('cancelled_at')) return 'cancelled';
  if (!model.get('occurred_at') && model.get('expected_at')) return 'scheduled';
  if (model.get('direction') === 'inbound') return 'received';
  return get(fixture, ['delivery', 'outcome'], 'unconfirmed');
}

function nativeLinks(model, currentActionId) {
  const action = model.getAction();
  const flow = action?.getFlow() || model.getFlow();
  const actionId = get(model.attributes, ['_action', 'id'], null);
  return {
    actionId,
    actionName: get(action, ['attributes', 'name'], null),
    flowId: get(flow, 'id', get(model.attributes, ['_flow', 'id'], null)),
    flowName: get(flow, ['attributes', 'name'], null),
    otherAction: !!actionId && actionId !== currentActionId,
  };
}

export function presentInteraction(model, { currentActionId = null } = {}) {
  const fixture = get(model.get('metadata'), 'prototype_fixture');
  if (!isFixture(fixture)) return presentLegacyMessage(model, fixture, currentActionId);
  if (fixture.kind === 'consent_audit') {
    return { kind: 'consent_audit', id: model.id, timestamp: model.get('occurred_at'), audit: fixture.audit, synthetic: true };
  }
  if (fixture.kind !== 'message' || model.get('channel') !== 'sms') return null;
  if (fixture.auto_reply === 'carrier_control') return { kind: 'hidden', id: model.id };
  return presentMessage(model, fixture, currentActionId);
}

function presentLegacyMessage(model, fixture, currentActionId) {
  if (model.get('channel') !== 'sms') return null;
  if (fixture?.synthetic !== true || fixture.namespace !== _MESSAGING_BINDINGS_.legacyNamespace) return null;
  const outcomes = { synthetic_received: 'received', synthetic_delivered: 'delivered', synthetic_not_delivered: 'not_delivered', synthetic_not_sent: 'not_sent' };
  return presentMessage(model, {
    body: fixture.body, origin: fixture.origin,
    auto_reply: fixture.origin === 'automated_auto_reply' ? 'acknowledgement' : 'none',
    delivery: { outcome: outcomes[fixture.status] || 'unconfirmed', reason_code: fixture.reason, recipient_number: fixture.attempted_number },
  }, currentActionId);
}

function presentMessage(model, fixture, currentActionId) {
  return {
    kind: 'message', id: model.id, body: fixture.body || '',
    direction: model.get('direction'), origin: fixture.origin,
    autoReply: fixture.auto_reply === 'acknowledgement',
    status: messageStatus(model, fixture),
    reasonCode: get(fixture, ['delivery', 'reason_code'], null),
    recipientNumber: get(fixture, ['delivery', 'recipient_number'], null),
    timestamp: model.get('cancelled_at') || model.getTimestamp(),
    senderName: actorDisplayName(fixture.provenance),
    ...nativeLinks(model, currentActionId),
    synthetic: true,
  };
}

export function actorDisplayName(actor) {
  if (typeof actor?.display_name !== 'string') return null;
  if (actor.synthetic !== true && !isAuthenticatedActor(actor)) return null;
  return actor.display_name.trim() || null;
}

function isAuthenticatedActor(actor) {
  return actor.source === 'authenticated_staff' && actor.synthetic === false
    && typeof actor.actor_id === 'string' && !!actor.actor_id;
}

export function sendResource({ id, patientId, actionId = null, body, recipientNumber, occurredAt }) {
  if (!contains(PATIENT_IDS, patientId)) throw new Error('Patient is outside the Messaging fixture scope.');
  if (!body?.trim() || !recipientNumber) throw new Error('A text and eligible recipient are required.');
  const data = {
    id, type: 'interactions',
    attributes: {
      direction: 'outbound', channel: 'sms', occurred_at: occurredAt,
      reference: `${ NAMESPACE }/interaction/${ id }`,
      metadata: { prototype_fixture: {
        synthetic: true, contract_version: 1, namespace: NAMESPACE,
        kind: 'message', body: body.trim(), origin: 'staff', auto_reply: 'none',
        delivery: { outcome: 'unconfirmed', reason_code: null, recipient_number: recipientNumber, updated_at: occurredAt },
      } },
    },
  };
  if (actionId) data.relationships = { action: { data: { type: 'patient-actions', id: actionId } } };
  return data;
}
