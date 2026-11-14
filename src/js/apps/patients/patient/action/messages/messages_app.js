import Backbone from 'backbone';
import { Radio } from 'marionette';

import App from 'js/base/app';
import { addError } from 'js/datadog';
import intl from 'js/i18n';
import ContextSession from 'js/apps/patients/shared/messaging/context-session';
import createComposerAdapter from 'js/apps/patients/shared/messaging/composer-adapter';
import ComposerView from 'js/apps/patients/shared/messaging/composer/composer_view';
import RecoveryView from 'js/apps/patients/shared/messaging/recovery_view';
import { presentInteraction } from 'js/entities-service/messaging-prototype/contract';
import { visibleHistory } from 'js/entities-service/messaging-prototype/history';
import InteractionWindowRead from 'js/entities-service/interaction-window-read';

import { HistoryListView } from './history_views';
import { MessagesView } from './messages_views';

const copy = intl.patients.messaging;

export default App.extend({
  viewEvents: {
    'load:older': 'loadOlder', 'click:latest': 'focusLatest',
    'before:destroy': 'onHostDestroyed',
  },
  onBeforeStart(app, options) {
    this.patient = options.patient;
    this.action = options.action;
    this.context = new ContextSession({ patientId: this.patient.id, action: this.action });
    this.confirmed = new Map();
    this.deleted = new Set();
    this.windowSize = 10;
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.listenTo(Radio.channel('messaging-prototype'), 'interaction:recorded', this.onRecorded);
    this.listenTo(Radio.channel('messaging-prototype'), 'context:changed', this.onContextChanged);
    this.showView(new MessagesView({ viewport: options.viewport }));
    this.viewport = this.getView().getUI('viewport')[0];
    this.getView().showStatus(copy.loading);
  },
  async prepareStart(options, { signal }) {
    const [models] = await Promise.all([this.readHistory(signal), this.context.refresh()]);
    return models;
  },
  readHistory(signal) {
    this.read = new InteractionWindowRead();
    return Radio.request('entities', 'fetch:messagingPrototype:history', { patientId: this.patient.id }, { signal, read: this.read });
  },
  onStart(app, options, models) {
    this.list = new HistoryListView({
      collection: new Backbone.Collection(), patient: this.patient, currentActionId: this.action.id,
      labels: { sms: copy.sms, showMore: copy.showMore },
    });
    this.listenTo(this.list, 'navigate:action', this.navigateToAction);
    this.getView().showChildView('history', this.list);
    this.setModels(models);
    this.getView().setBusy(false);
    this.startComposer();
    this.getView().showChildView('recovery', new RecoveryView({ patientId: this.patient.id }));
    this.scrollListener = () => this.onViewportScroll();
    this.viewport.addEventListener('scroll', this.scrollListener, { passive: true });
    this.lastScrollTop = this.viewport.scrollTop;
    requestAnimationFrame(() => {
      if (!this.isRunning()) return;
      this.focusLatest();
      if (this.dirty) this.refreshHistory();
    });
  },
  startComposer() {
    this.composerAdapter = createComposerAdapter({ patient: this.patient, action: this.action, context: this.context });
    this.getView().showChildView('composer', new ComposerView({
      patientId: this.patient.id, actionId: this.action.id, sessionScope: this.composerAdapter.sessionScope, adapter: this.composerAdapter,
    }));
  },
  setModels(models, { retainWindow = false } = {}) {
    const first = this.list.collection.first()?.id;
    this.rawModels = models;
    const all = new Map(models.filter(model => !this.deleted.has(model.id)).map(model => [model.id, model]));
    this.confirmed.forEach((model, id) => {
      if (!this.deleted.has(id)) all.set(id, model);
    });
    this.models = visibleHistory([...all.values()], presentInteraction, this.action.id);
    if (retainWindow && first) {
      const index = this.models.findIndex(model => model.id === first);
      if (index >= 0) this.windowSize = Math.max(this.windowSize, this.models.length - index);
    }
    this.list.collection.set(this.models.slice(-this.windowSize));
    this.getView().showStatus(this.models.length ? '' : copy.empty);
    this.updateWindow();
  },
  updateWindow() {
    this.getView().setWindow(this.models.length > this.windowSize, this.list.currentDay(this.viewport));
  },
  onViewportScroll() {
    const upward = this.viewport.scrollTop < this.lastScrollTop;
    this.lastScrollTop = this.viewport.scrollTop;
    if (upward && this.viewport.scrollHeight - this.viewport.scrollTop - this.viewport.clientHeight > 5) this.getView().stopFollowingLatest();
    if (upward && !this.getView().followingLatest && this.list.nearBeginning(this.viewport)) this.loadOlder();
    this.updateWindow();
  },
  loadOlder() {
    if (!this.models || this.windowSize >= this.models.length) return;
    const anchor = this.list.captureAnchor(this.viewport);
    this.getView().stopFollowingLatest();
    this.windowSize += 10;
    this.list.collection.set(this.models.slice(-this.windowSize));
    this.list.restoreAnchor(anchor, this.viewport);
    this.updateWindow();
  },
  focusLatest() {
    this.getView().focusLatest();
    this.lastScrollTop = this.viewport.scrollTop;
  },
  onInteractionMessage(message) {
    if (message.payload?.patient?.id !== this.patient.id) return;
    if (message.category === 'ResourceDeleted') {
      this.deleted.add(message.resource.id);
      this.confirmed.delete(message.resource.id);
    }
    this.read?.record(message);
    if (this.isRunning()) this.refreshHistory();
    else this.dirty = true;
  },
  onRecorded({ patientId, model }) {
    if (patientId !== this.patient.id) return;
    if (this.deleted.has(model.id)) return;
    this.confirmed.set(model.id, model);
    if (this.isRunning()) {
      // The persisted POST is authoritative even if a later full scan fails.
      const anchor = this.list.captureAnchor(this.viewport);
      this.setModels(this.rawModels || [], { retainWindow: true });
      this.list.restoreAnchor(anchor, this.viewport);
      this.refreshHistory();
    } else this.dirty = true;
  },
  onContextChanged({ patientId }) {
    if (patientId === this.patient.id && this.isRunning()) this.refreshHistory();
  },
  async refreshHistory() {
    this.dirty = false;
    this.historyController?.abort();
    const controller = this.historyController = new AbortController();
    const anchor = this.list.captureAnchor(this.viewport);
    this.getView().setBusy(true);
    try {
      const models = await this.readHistory(controller.signal);
      if (controller.signal.aborted) return;
      this.setModels(models, { retainWindow: true });
      this.list.restoreAnchor(anchor, this.viewport);
    } catch(error) {
      if (controller.signal.aborted) return;
      this.getView().showStatus(copy.refreshError);
      addError(error);
    } finally {
      if (!controller.signal.aborted && this.isRunning()) this.getView().setBusy(false);
    }
  },
  navigateToAction(model, actionId) {
    const action = model.getAction();
    const flow = action?.getFlow();
    if (flow) Radio.trigger('event-router', 'patient:flow:action', this.patient.id, flow.id, actionId);
    else Radio.trigger('event-router', 'patient:action', this.patient.id, actionId);
  },
  handleStartFailure(options, error) {
    this.getView()?.showStatus(copy.refreshError);
    addError(error);
  },
  onHostDestroyed() {
    // Initial preparation can fail while stopped; the shell still owns cleanup.
    this.releaseResources();
    this.stop();
  },
  onStop() {
    this.releaseResources();
  },
  releaseResources() {
    this.historyController?.abort();
    this.composerAdapter?.dispose();
    this.composerAdapter = null;
    this.context?.destroy();
    this.context = null;
    this.stopListening(Radio.channel('ws'));
    this.stopListening(Radio.channel('messaging-prototype'));
    this.viewport?.removeEventListener('scroll', this.scrollListener);
  },
});
