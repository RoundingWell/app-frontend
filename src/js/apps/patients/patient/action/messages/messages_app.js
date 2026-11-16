import Backbone from 'backbone';
import { Radio } from 'marionette';

import App from 'js/base/app';
import { addError } from 'js/datadog';
import intl from 'js/i18n';
import InteractionWindowRead from 'js/entities-service/interaction-window-read';
import { comparePositions, position } from 'js/entities-service/interaction-order';
import { isActionHistoryMessage } from 'js/entities-service/interaction-messages';

import { HistoryListView } from './history_views';
import { MessagesView } from './messages_views';

const copy = intl.patients.messaging;

export default App.extend({
  viewEvents: {
    'load:older': 'loadOlder', 'click:latest': 'focusLatest',
    'before:destroy': 'onHostDestroyed',
  },
  onBeforeStart(app, { patient, action, viewport }) {
    this.patient = patient;
    this.action = action;
    this.hostDestroyed = false;
    this.dirty = false;
    this.deleted = new Set();
    this.models = [];
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.showView(new MessagesView({ viewport }));
    this.viewport = this.getView().getUI('viewport')[0];
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
    this.list = new HistoryListView({
      collection: new Backbone.Collection(), patient: this.patient, currentActionId: this.action.id,
      labels: { sms: copy.sms, showMore: copy.showMore },
    });
    this.listenTo(this.list, 'navigate:action', this.navigateToAction);
    this.listenTo(this.list, 'navigate:flow', this.navigateToFlow);
    this.getView().showChildView('history', this.list);
    this.commitWindow(window);
    this.getView().setBusy(false);
    this.scrollListener = () => this.onViewportScroll();
    this.viewport.addEventListener('scroll', this.scrollListener, { passive: true });
    this.lastScrollTop = this.viewport.scrollTop;
    requestAnimationFrame(() => {
      if (!this.isRunning() || this.hostDestroyed) return;
      this.getView().followingLatest = true;
      this.getView().scrollLatest();
      this.lastScrollTop = this.viewport.scrollTop;
      if (options.focusOnLoad) this.focusLatest();
      if (this.dirty) this.refreshHistory();
    });
  },
  commitWindow(window, append = false) {
    const models = new Map((append ? this.models : []).map(model => [model.id, model]));
    window.models.forEach(model => models.set(model.id, model));
    this.models = [...models.values()].filter(model => !this.deleted.has(model.id));
    this.models.sort((left, right) => comparePositions(position(left), position(right)));
    this.before = window.before;
    this.hasOlder = window.hasOlder;
    this.list.collection.set(this.models.filter(model => isActionHistoryMessage(model, this.action.id)));
    this.getView().showStatus(this.list.collection.length ? '' : copy.empty);
    this.updateWindow();
  },
  updateWindow() {
    this.getView().setWindow(this.hasOlder, this.list.currentDay(this.viewport));
  },
  onViewportScroll() {
    const upward = this.viewport.scrollTop < this.lastScrollTop;
    this.lastScrollTop = this.viewport.scrollTop;
    if (upward && this.viewport.scrollHeight - this.viewport.scrollTop - this.viewport.clientHeight > 5) this.getView().stopFollowingLatest();
    if (upward && !this.getView().followingLatest && this.list.nearBeginning(this.viewport)) this.loadOlder();
    this.updateWindow();
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
      if (!this.canCommit(controller)) return;
      const anchor = this.list.captureAnchor(this.viewport);
      const following = this.getView().followingLatest;
      this.commitWindow(window, append);
      if (following) this.getView().scrollLatest();
      else this.list.restoreAnchor(anchor, this.viewport);
      this.lastScrollTop = this.viewport.scrollTop;
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
    if (!this.list || this.hostDestroyed) return;
    this.getView().focusLatest();
    this.lastScrollTop = this.viewport.scrollTop;
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
  onStop() {
    this.releaseResources();
  },
  releaseResources() {
    this.controller?.abort();
    this.controller = null;
    this.stopListening(Radio.channel('ws'));
    this.viewport?.removeEventListener('scroll', this.scrollListener);
  },
});
