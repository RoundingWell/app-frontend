import { Radio } from 'marionette';

import App from 'js/base/app';
import { addError } from 'js/datadog';
import intl from 'js/i18n';
import InteractionWindowRead from 'js/entities-service/interaction-window-read';
import { comparePositions, position } from 'js/entities-service/interaction-order';
import { isActionHistoryMessage } from 'js/entities-service/interaction-messages';

import { MessagesView } from './messages_views';

const copy = intl.patients.messaging;

export default App.extend({
  viewEvents: {
    'load:older': 'loadOlder', 'click:latest': 'focusLatest',
    'navigate:action': 'navigateToAction', 'navigate:flow': 'navigateToFlow',
    'ready:history': 'onHistoryReady',
    'before:destroy': 'onHostDestroyed',
  },
  onBeforeStart(app, { patient, action, viewport }) {
    this.patient = patient;
    this.action = action;
    this.hostDestroyed = false;
    this.dirty = false;
    this.deleted = new Set();
    this.models = [];
    this.showView(new MessagesView({ viewport, patient, currentActionId: action.id }));
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.getView().showStatus(copy.loading);
  },
  prepareStart(options, { signal }) {
    return this.readWindow({}, signal);
  },
  readWindow(query, signal) {
    this.read = new InteractionWindowRead();
    return Radio.request('entities', 'fetch:interactions:messages:window', {
      patientId: this.patient.id, actionId: this.action.id, ...query,
    }, { signal, read: this.read });
  },
  onStart(app, options, window) {
    this.commitWindow(window);
    this.getView().setBusy(false);
    this.getView().startHistory(options.focusOnLoad);
  },
  onHistoryReady() {
    if (this.dirty) this.refreshHistory();
  },
  commitWindow(window, append = false) {
    const models = new Map((append ? this.models : []).map(model => [model.id, model]));
    window.models.forEach(model => models.set(model.id, model));
    this.models = [...models.values()].filter(model => !this.deleted.has(model.id));
    this.models.sort((left, right) => comparePositions(position(left), position(right)));
    this.before = window.before;
    this.hasOlder = window.hasOlder;
    this.getView().renderHistory(this.models.filter(model => isActionHistoryMessage(model, this.action.id)), this.hasOlder);
  },
  loadOlder() {
    if (!this.hasOlder || this.controller || !this.isRunning()) return;
    this.getView().stopFollowingLatest();
    return this.loadWindow({ before: this.before }, true);
  },
  refreshHistory() {
    if (this.controller || !this.isRunning()) {
      this.dirty = true;
      return;
    }
    this.dirty = false;
    return this.loadWindow({ requiredIds: this.models.filter(model => !this.deleted.has(model.id)).map(model => model.id) });
  },
  async loadWindow(query, append = false) {
    const controller = this.controller = new AbortController();
    this.getView().setBusy(true);
    try {
      const window = await this.readWindow(query, controller.signal);
      controller.signal.throwIfAborted();
      this.commitWindow(window, append);
    } catch(error) {
      if (this.canCommit(controller)) {
        this.getView().showStatus(copy.refreshError);
        addError(error);
      }
    } finally {
      this.finishRead(controller);
    }
  },
  canCommit(controller) {
    return !controller.signal.aborted && !this.hostDestroyed && this.isRunning();
  },
  finishRead(controller) {
    if (this.controller === controller) this.controller = null;
    if (!this.canCommit(controller)) return;
    this.getView().setBusy(false);
    if (this.dirty) this.refreshHistory();
  },
  focusLatest() {
    if (!this.isRunning() || this.hostDestroyed) return;
    this.getView().focusLatest();
  },
  onInteractionMessage(message) {
    if (message.payload?.patient?.id !== this.patient.id || this.hostDestroyed) return;
    if (message.category === 'ResourceDeleted') this.deleted.add(message.resource.id);
    this.read?.record(message);
    if (this.isRunning()) this.refreshHistory();
    else this.dirty = true;
  },
  navigateToAction(model, actionId) {
    const flow = model.getAction()?.getFlow();
    if (flow) Radio.trigger('event-router', 'patient:flow:action', this.patient.id, flow.id, actionId);
    else Radio.trigger('event-router', 'patient:action', this.patient.id, actionId);
  },
  navigateToFlow(flowId) {
    Radio.trigger('event-router', 'patient:flow', this.patient.id, flowId);
  },
  handleStartFailure(options, error) {
    this.getView()?.showStatus(copy.refreshError);
    this.getView()?.setBusy(false);
    addError(error);
  },
  onHostDestroyed() {
    this.hostDestroyed = true;
    this.releaseResources();
    this.stop();
  },
  onBeforeStop() {
    this.releaseResources();
  },
  releaseResources() {
    this.controller?.abort();
    this.controller = null;
    this.stopListening(Radio.channel('ws'));
  },
});
