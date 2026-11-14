import Backbone from 'backbone';
import { get, some } from 'underscore';
import { MnObject, Radio } from 'marionette';

import { actionSummary, composerContext, FIELD_NAME } from 'js/entities-service/messaging-prototype/contract';

// A host owns this alongside its child composer. It owns only the eligibility
// read, not the patient's websocket subscription or the host's message window.
export default MnObject.extend({
  initialize({ patientId, action = null, read, state = new Backbone.Model() }) {
    this.patientId = patientId;
    this.action = action;
    this.read = read || ((query, options) => Radio.request('entities', 'fetch:messagingPrototype:context', query, options));
    this.state = state;
    state.set({ patientId, actionId: get(action, 'id', null), enabled: false, disabledReason: 'loading', recipients: [], loading: true });
    if (action) this.listenTo(action, 'change:_state change:options', this.onEligibilityChanged);
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.listenTo(Radio.channel('ws'), 'message', this.onFieldMessage);
    this.listenTo(Radio.channel('messaging-prototype'), 'interaction:recorded', this.onRecordedInteraction);
    this.listenTo(Radio.channel('messaging-prototype'), 'send:uncertain', this.onUncertainSend);
    this.listenTo(Radio.channel('messaging-prototype'), 'context:changing', this.onContextChanging);
    this.listenTo(Radio.channel('messaging-prototype'), 'context:changed', this.onRecordedInteraction);
  },
  async refresh({ fresh, readKey } = {}) {
    if (!this.value) this.invalidate();
    this.controller?.abort();
    const controller = this.controller = new AbortController();
    // Ordinary conversation reads keep current eligibility. Explicit policy
    // changes invalidate it; every submission still awaits fresh validation.
    try {
      const value = await this.read({ patientId: this.patientId }, { signal: controller.signal, fresh, readKey });
      if (controller.signal.aborted) return false;
      const projection = composerContext({ value, patientId: this.patientId, action: this.action });
      const summary = this.action ? actionSummary(value, this.action.id) : null;
      this.value = value;
      this.state.set({ ...projection, summary, loading: false });
      this.triggerMethod('context:updated', this.state);
      return true;
    } catch(error) {
      if (controller.signal.aborted) return false;
      this.value = null;
      this.state.set({ enabled: false, disabledReason: 'load_error', recipients: [], loading: false, summary: null });
      this.triggerMethod('context:failed', error);
      return false;
    }
  },
  onInteractionMessage(message) {
    if (message.payload?.patient?.id !== this.patientId) return;
    this.refresh({ readKey: message });
  },
  onFieldMessage(message) {
    if (message.category !== 'FieldUpdated') return;
    if (!this.isPatientFieldMessage(message)) return;
    this.invalidate();
    this.refresh({ readKey: message });
  },
  isPatientFieldMessage(message) {
    if (message.resource?.type === 'patients') return message.resource.id === this.patientId;
    if (message.resource?.type !== 'patient-fields') return false;
    // Field IDs follow the native patient/name identity, even before the Store
    // notification model has relationships or a field name.
    return some(['phones', FIELD_NAME], name => Radio.request('entities', 'patientFields:model', {
      name, _patient: { id: this.patientId, type: 'patients' },
    }).createId() === message.resource.id);
  },
  onRecordedInteraction(data) {
    if (data.patientId === this.patientId) this.refresh({ readKey: data });
  },
  onUncertainSend({ patientId }) {
    if (patientId === this.patientId) this.state.set({ enabled: false, disabledReason: 'uncertain' });
  },
  onContextChanging({ patientId }) {
    if (patientId === this.patientId) this.invalidate();
  },
  invalidate() {
    this.controller?.abort();
    this.state.set({ enabled: false, disabledReason: 'refresh_required', loading: true });
  },
  onEligibilityChanged() {
    this.invalidate();
    return this.refresh({ fresh: true });
  },
  onBeforeDestroy() {
    this.controller?.abort();
  },
});
