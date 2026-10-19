import Backbone from 'backbone';
import dayjs from 'dayjs';
import { contains, flatten, has, keys, map, without } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { compareInteractions, compareToBound } from 'js/entities-service/entities/interactions';

import { isPatientInteractionMessage } from 'js/apps/patients/shared/interactions/live-updates';

import { InteractionsPageView } from './interactions_views';

const PAGE_SIZE = 25;

export default App.extend({
  createState() {
    return new Backbone.Model({ interactionId: undefined, selectedGroups: [], hasOlder: false, hasNewer: false, request: null, retry: null, contentStatus: 'loading' });
  },
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
    'change:filter': 'toggleFilter',
    'load:edge': 'requestInteractions',
    'retry:paging': 'retryRequest',
    'select:date': 'jumpToDate',
  },
  onBeforeStart(app, { patient, interactionId, kind = 'replace', date }) {
    if (!this.getView()) this.showPage({ patient, interactionId });
    if (this.getState().get('request')?.kind === 'update') this.refreshPending = true;
    this.getState().set({ request: { kind, date }, retry: null, ...(kind === 'replace' && { hasOlder: false, hasNewer: false }) });
    if (kind === 'replace') this.getView().showLoading();
  },
  showPage({ patient, interactionId }) {
    this.patient = patient;
    this.refreshPending = false;
    this.channelGroups = Radio.request('entities', 'interactions:channelGroups');
    this.getState().set({ interactionId, selectedGroups: keys(this.channelGroups), contentStatus: 'loading' });
    this.showView(new InteractionsPageView({
      model: patient,
      state: this.getState(),
    }));
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    Radio.request('ws', 'subscribe', patient);
  },
  async prepareStart({ kind = 'replace', date, at }, { signal }) {
    const input = this.getRequest(kind, date, at);
    if (at) input.filterAnchor = true;
    let result = await this.loadWindow(input, { signal });
    // Collection hydration does not use the model message queue.
    while (this.refreshPending) {
      this.refreshPending = false;
      input.live = true;
      result = await Radio.request('entities', 'fetch:interactions:window:refresh', input, result || this.getWindow(), { signal });
    }
    return { result, input };
  },
  async loadWindow(input, { signal }) {
    const { kind, date } = input;
    if (kind === 'focus') return this.getWindow();
    if (input.channels && !input.channels.length) {
      return { models: [], hasOlder: false, hasNewer: false };
    }
    if (kind === 'update') return this.loadInteraction(input, { signal });
    if (kind === 'replace') {
      return this.loadInitialWindow(input, { signal });
    }
    if (kind === 'older' || kind === 'newer') {
      return Radio.request('entities', 'fetch:interactions:window:adjacent', input, this.getWindow(), kind, { signal });
    }
    return Radio.request('entities', 'fetch:interactions:window:toDate', input, this.getWindow(), date, { signal });
  },
  async loadInitialWindow(input, options) {
    const window = await Radio.request('entities', 'fetch:interactions:window:initial', input, options);
    if (!input.date || input.filterAnchor) return window;
    return Radio.request('entities', 'fetch:interactions:window:toDate', input, window, input.date, options);
  },
  onStart(app, options, { result, input }) {
    if (!result) return this.getState().set({ request: null, retry: null });
    this.showInteractions(result, input);
    this.refillEmptyWindow();
  },
  handleStartFailure(options, error) {
    const { kind = 'replace', date, at } = options;
    if (kind === 'replace') {
      this.collection = null;
      this.getView().showError();
    }
    this.getState().set({ request: null, retry: { kind, date, at } });
    addError(error);
    return false;
  },
  onBeforeDestroyView() {
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.stop();
  },
  onStop() {
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.refreshPending = false;
    this.collection = null;
    this.filterPosition = null;
    this.getState().set({ request: null, retry: null, hasOlder: false, hasNewer: false });
  },
  onInteractionMessage(message, model) {
    if (!isPatientInteractionMessage(message, this.patient)) return;
    if (this.getState().get('request')) {
      this.refreshPending = true;
      return;
    }
    if (!this.collection) return;
    if (message.category === 'ResourceDeleted') return this.refillEmptyWindow();
    const attributes = message.payload.attributes;
    if (!this.collection.get(model) || has(attributes, 'action_id') || has(attributes, 'flow_id')) {
      return this.requestInteractions('update', undefined, model.id);
    }
    this.reconcileInteraction(message, model);
  },
  reconcileInteraction({ category }, model) {
    if (category === 'ResourceCreated') return;
    const previous = model.previous('occurred_at') || model.previous('expected_at');
    const first = this.collection.first();
    const last = this.collection.last();
    const lower = { id: first.id, timestamp: first === model ? previous : first.getTimestamp() };
    const upper = { id: last.id, timestamp: last === model ? previous : last.getTimestamp() };
    const models = this.collection.filter(item => item !== model);
    if (this.isInWindow(model, lower, upper)) models.push(model);
    this.getView().updateInteractions(this.collection, models.sort(compareInteractions), { live: true });
    this.refillEmptyWindow();
  },
  async loadInteraction(input, { signal }) {
    const window = this.getWindow();
    const first = window.models[0];
    const last = window.models[window.models.length - 1];
    const lower = first && { id: first.id, timestamp: first.getTimestamp() };
    const upper = last && { id: last.id, timestamp: last.getTimestamp() };
    const wasLoaded = !!this.collection.get(input.at);
    const model = await Radio.request('entities', 'fetch:interactions:model:byPatient', input, { signal });
    const inWindow = this.isInWindow(model, lower, upper);
    if (!wasLoaded && !inWindow) return null;
    const models = window.models.filter(item => item.id !== input.at);
    if (inWindow) models.push(model);
    return { ...window, models: models.sort(compareInteractions) };
  },
  isInWindow(model, lower, upper) {
    if (!model?.getTimestamp()) return false;
    const { hasOlder, hasNewer } = this.getState().attributes;
    return (!hasOlder || !lower || compareToBound(model, lower) >= 0)
      && (!hasNewer || !upper || compareToBound(model, upper) <= 0);
  },
  refillEmptyWindow() {
    const { request, hasOlder, hasNewer } = this.getState().attributes;
    if (!this.collection || this.collection.length || request || (!hasOlder && !hasNewer)) return;
    this.getState().set('interactionId', undefined);
    this.requestInteractions('replace', this.getView().getCurrentDate());
  },
  getRequest(kind, date, at = this.getState().get('interactionId')) {
    if (kind === 'replace' && !this.collection && !at && !date) date = dayjs().format('YYYY-MM-DD');
    const selectedGroups = this.getState().get('selectedGroups');
    const channels = flatten(map(selectedGroups, group => this.channelGroups[group]));
    return {
      kind,
      date,
      patientId: this.patient.id,
      channels: selectedGroups.length === keys(this.channelGroups).length ? undefined : channels,
      at,
      limit: PAGE_SIZE,
    };
  },
  enableInteractionGroup(interactionId) {
    if (!interactionId) return false;
    const target = Radio.request('entities', 'interactions:model', interactionId);
    const group = target?.getChannelGroup();
    const selectedGroups = this.getState().get('selectedGroups');
    if (!group || contains(selectedGroups, group)) return false;
    this.getState().set('selectedGroups', [...selectedGroups, group]);
    return true;
  },
  navigateToInteraction(interactionId) {
    const changedGroups = this.enableInteractionGroup(interactionId);
    this.getState().set({ interactionId });
    const request = this.getState().get('request');
    const pendingFilter = request?.kind === 'replace';
    const loaded = this.collection && (!interactionId || this.collection.get(interactionId));
    if (!loaded || pendingFilter || changedGroups) return this.requestInteractions('replace');
    if (request) return this.requestInteractions('focus');
    this.getView().focusInteraction(this.collection.get(interactionId));
    return Promise.resolve(true);
  },
  toggleFilter(group) {
    const date = this.getView().getCurrentDate();
    const anchor = this.collection?.find(model => dayjs(model.getTimestamp()).format('YYYY-MM-DD') === date);
    const at = anchor?.id || (this.filterPosition?.date === date ? this.filterPosition.at : undefined);
    this.filterPosition = { date, at };
    const selectedGroups = this.getState().get('selectedGroups');
    this.getState().set({
      selectedGroups: contains(selectedGroups, group) ? without(selectedGroups, group) : [...selectedGroups, group],
      interactionId: undefined,
    });
    this.requestInteractions('replace', date, at);
  },
  requestInteractions(kind, date, at) {
    const options = { kind, date, at };
    return this.restart(options).catch(error => this.handleStartFailure(options, error));
  },
  retryRequest() {
    const { kind, date, at } = this.getState().get('retry');
    this.requestInteractions(kind, date, at);
  },
  jumpToDate(date) {
    // A navigation intent supersedes paging, including a pending filter refresh.
    const kind = !this.collection || this.getState().get('request')?.kind === 'replace' ? 'replace' : 'date';
    this.requestInteractions(kind, date);
  },
  getWindow() {
    const { hasOlder, hasNewer } = this.getState().attributes;
    return { models: [...this.collection.models], hasOlder, hasNewer };
  },
  showInteractions({ models, hasOlder, hasNewer }, input) {
    const view = this.getView();
    this.commitInteractions(models, input);
    if (input.kind === 'focus') {
      view.focusInteraction(this.collection.get(this.getState().get('interactionId')));
    }
    if (input.date) view.scrollToDate(input.date);
    this.getState().set({ hasOlder, hasNewer, request: null, retry: null });
  },
  commitInteractions(models, input) {
    const view = this.getView();
    if (input.kind === 'replace') {
      this.collection = Radio.request('entities', 'interactions:collection', models);
      view.showInteractions(this.collection);
      if (!input.at) view.scrollToLatest();
      return;
    }
    view.updateInteractions(this.collection, models, { live: input.kind === 'update' || input.live });
  },
});
