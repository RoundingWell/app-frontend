import Backbone from 'backbone';

import { PATIENT_IDS, NAMESPACE, WORKSPACE_ID, isPrototypeTarget, readContext, composerContext, actionSummary, presentInteraction, sendResource } from './contract';

function fixtureContext() {
  return {
    synthetic: true, contract_version: 1, namespace: NAMESPACE, patient_id: PATIENT_IDS[0], messaging_enabled: true, dnc: false,
    recipients: [
      { number: '+12025550142', label: 'Mobile', state: 'opted_in', eligible: true, staff_change_allowed: true },
      { number: '+12025550190', label: 'Second mobile', state: 'opted_out', eligible: false, disabled_reason: 'opted_out' },
    ],
    interactions_composer: { enabled: true },
    actions: { action: { state_id: 'open', composer: { enabled: true }, message_count: 42, latest_text: 'Action-owned text', latest_interaction_id: 'latest' } },
  };
}

function actionModel(stateId = 'open', status = 'started') {
  const action = new Backbone.Model({ id: 'action', options: { embed: 'compose' }, _patient: { id: PATIENT_IDS[0] }, _state: { id: stateId } });
  action.getState = () => new Backbone.Model({ id: stateId, status });
  return action;
}

function interaction(attributes = {}, fixture = {}) {
  const model = new Backbone.Model({
    id: 'interaction', channel: 'sms', direction: 'outbound', occurred_at: '2026-11-12T12:00:00Z',
    ...attributes,
    metadata: { prototype_fixture: {
      synthetic: true, contract_version: 1, namespace: NAMESPACE, kind: 'message', body: 'A synthetic text',
      auto_reply: 'none', delivery: { outcome: 'unconfirmed' }, ...fixture,
    } },
  });
  model.getTimestamp = () => model.get('occurred_at') || model.get('expected_at');
  model.getAction = () => undefined;
  model.getFlow = () => undefined;
  return model;
}

context('synthetic Messaging contract adapter', function() {
  specify('accepts only the exact target, workspace and reviewed patients', function() {
    const target = { hostname: 'messaging-demo.invalid', stage: 'dev', organization: 'demo', workspaceId: WORKSPACE_ID, patientId: PATIENT_IDS[0] };
    expect(isPrototypeTarget(target)).to.equal(true);
    for (const [key, value] of Object.entries({ hostname: 'other-demo.invalid', stage: 'prod', organization: 'other-organization', workspaceId: 'other', patientId: 'other' })) {
      expect(isPrototypeTarget({ ...target, [key]: value }), key).to.equal(false);
    }
    expect(() => readContext({ ...fixtureContext(), namespace: 'old' })).to.throw('unsupported');
    expect(() => readContext({ ...fixtureContext(), contract_version: 2 })).to.throw('unsupported');
  });

  specify('keeps actionless eligibility independent of action state and requires current native state projection', function() {
    const value = fixtureContext();
    const action = actionModel();
    expect(composerContext({ value, patientId: PATIENT_IDS[0], action }).enabled).to.equal(true);
    value.actions.action.composer.enabled = false;
    expect(composerContext({ value, patientId: PATIENT_IDS[0] })).to.include({ enabled: true, actionId: null });
    value.actions.action.composer.enabled = true;
    action.set('_state', { id: 'different' });
    expect(composerContext({ value, patientId: PATIENT_IDS[0], action })).to.include({ enabled: false, disabledReason: 'refresh_required' });
    action.set('_state', null);
    delete value.actions.action;
    expect(composerContext({ value, patientId: PATIENT_IDS[0], action }).enabled).to.equal(false);
  });

  specify('applies DNC and recipient changes consistently to an already open composer', function() {
    const value = fixtureContext();
    let projection = composerContext({ value, patientId: PATIENT_IDS[0] });
    expect(projection.recipients.map(row => row.eligible)).to.deep.equal([true, false]);
    value.dnc = true;
    projection = composerContext({ value, patientId: PATIENT_IDS[0] });
    expect(projection).to.include({ enabled: false, disabledReason: 'do_not_contact' });
    expect(projection.recipients.every(row => !row.eligible)).to.equal(true);
    value.dnc = false;
    value.recipients = [];
    expect(composerContext({ value, patientId: PATIENT_IDS[0] })).to.include({ enabled: false, disabledReason: 'no_eligible_mobile' });
    value.messaging_enabled = false;
    expect(composerContext({ value, patientId: PATIENT_IDS[0] }).disabledReason).to.equal('messaging_disabled');
  });

  specify('disables native Done and scheduled composers without inferring Scheduled from queued', function() {
    const value = fixtureContext();
    expect(composerContext({ value, patientId: PATIENT_IDS[0], action: actionModel('open', 'queued') }).enabled).to.equal(true);
    expect(composerContext({ value, patientId: PATIENT_IDS[0], action: actionModel('open', 'done') })).to.include({ enabled: false, disabledReason: 'action_done' });
    value.actions.action.composer.scheduled_interaction_id = 'scheduled';
    expect(composerContext({ value, patientId: PATIENT_IDS[0], action: actionModel() })).to.include({ enabled: false, disabledReason: 'scheduled', scheduledInteractionId: 'scheduled' });
    const otherPatient = actionModel();
    otherPatient.set('_patient', { id: 'other' });
    expect(composerContext({ value, patientId: PATIENT_IDS[0], action: otherPatient }).enabled).to.equal(false);
  });

  specify('uses complete action-local summaries without deriving counts from a history page', function() {
    const value = fixtureContext();
    expect(actionSummary(value, 'action')).to.deep.equal({ messageCount: 42, latestText: 'Action-owned text', latestInteractionId: 'latest' });
    expect(actionSummary(value, 'unloaded')).to.equal(null);
    value.actions.action.message_count = -1;
    expect(actionSummary(value, 'action')).to.equal(null);
  });

  specify('uses native cancellation time and associations over display metadata', function() {
    const model = interaction({ occurred_at: null, expected_at: '2026-11-13T12:00:00Z', cancelled_at: '2026-11-12T09:00:00Z', _action: { id: 'other-action' } });
    expect(presentInteraction(model, { currentActionId: 'current' })).to.include({ status: 'cancelled', timestamp: '2026-11-12T09:00:00Z', actionId: 'other-action', otherAction: true });
    model.unset('cancelled_at');
    expect(presentInteraction(model).status).to.equal('scheduled');
    model.set({ occurred_at: '2026-11-12T12:00:00Z', _action: { id: 'current' } });
    expect(presentInteraction(model, { currentActionId: 'current' })).to.include({ otherAction: false, status: 'unconfirmed' });
    model.unset('_action');
    expect(presentInteraction(model)).to.include({ otherAction: false, actionId: null });
  });

  specify('keeps audit rows separate, hides classified carrier replies and retains acknowledgements', function() {
    const audit = interaction({}, { kind: 'consent_audit', audit: { event: 'opted_out', number: '+12025550142', occurred_at: 'wrong' } });
    expect(presentInteraction(audit)).to.include({ kind: 'consent_audit', timestamp: '2026-11-12T12:00:00Z' });
    expect(presentInteraction(interaction({}, { auto_reply: 'carrier_control' }))).to.deep.equal({ kind: 'hidden', id: 'interaction' });
    expect(presentInteraction(interaction({}, { auto_reply: 'acknowledgement' }))).to.include({ kind: 'message', autoReply: true });
    expect(presentInteraction(interaction({ direction: 'inbound' }))).to.include({ status: 'received' });
    expect(presentInteraction(interaction({}, { namespace: 'old' }))).to.equal(null);
    const legacy = interaction({}, { namespace: _MESSAGING_BINDINGS_.legacyNamespace, status: 'synthetic_delivered' });
    expect(presentInteraction(legacy)).to.include({ kind: 'message', status: 'delivered' });
    legacy.set('channel', 'voice');
    expect(presentInteraction(legacy)).to.equal(null);
  });

  specify('uses authenticated staff snapshots without replacing historical synthetic attribution', function() {
    const provenance = { source: 'authenticated_staff', synthetic: false, actor_id: 'native-editor', display_name: 'Casey Example', role_id: 'role', role_name: 'administrator', role_label: 'Administrator' };
    expect(presentInteraction(interaction({}, { provenance }))).to.include({ senderName: 'Casey Example', status: 'unconfirmed', synthetic: true });
    expect(presentInteraction(interaction({}, { provenance: { synthetic: true, display_name: 'Historical Example' } })).senderName).to.equal('Historical Example');
    expect(presentInteraction(interaction({}, { provenance: { ...provenance, source: 'unknown' } })).senderName).to.equal(null);
    expect(presentInteraction(interaction({}, { provenance: { ...provenance, actor_id: null } })).senderName).to.equal(null);
  });

  specify('constructs record-only native sends with explicit actionless and action-bound relationships', function() {
    const params = { id: 'new', patientId: PATIENT_IDS[0], body: '  Synthetic text  ', recipientNumber: '+12025550142', occurredAt: '2026-11-12T12:00:00Z' };
    const actionless = sendResource(params);
    expect(actionless).not.to.have.property('relationships');
    expect(actionless.attributes.metadata).to.have.all.keys('prototype_fixture');
    expect(actionless.attributes.metadata.prototype_fixture).to.include({ body: 'Synthetic text', synthetic: true });
    const linked = sendResource({ ...params, actionId: 'action' });
    expect(linked.relationships).to.deep.equal({ action: { data: { type: 'patient-actions', id: 'action' } } });
    expect(() => sendResource({ ...params, patientId: 'other' })).to.throw('outside');
  });
});
