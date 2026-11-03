import Backbone from 'backbone';
import dayjs from 'dayjs';
import { contains, flatten, has, keys, map, without } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { compareInteractions } from 'js/entities-service/entities/interactions';
import InteractionWindowRead from 'js/entities-service/interaction-window-read';

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
  onBeforeStart(app, { patient, interactionId, kind = 'replace', date, at }) {
    if (!this.getView()) this.showPage({ patient, interactionId });
    const anchor = at === undefined ? this.getState().get('interactionId') : at;
    this.getState().set({ request: { kind, date, at: anchor }, retry: null, ...(kind === 'replace' && { hasOlder: false, hasNewer: false }) });
    if (kind === 'replace') this.getView().showLoading();
  },
  showPage({ patient, interactionId }) {
    this.patient = patient;
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.channelGroups = Radio.request('entities', 'interactions:channelGroups');
    this.getState().set({ interactionId, selectedGroups: keys(this.channelGroups), contentStatus: 'loading' });
    this.showView(new InteractionsPageView({
      model: patient,
      state: this.getState(),
    }));
  },
  async prepareStart({ kind = 'replace', date, at }, { signal }) {
    const input = this.getRequest(kind, date, at);
    if (at) input.filterAnchor = true;
    if (kind === 'replace' && !this.collection && !input.at && !date) input.date = dayjs().format('YYYY-MM-DD');
    const read = this.pendingRead = new InteractionWindowRead(input.date);
    const result = await this.loadWindow(input, { signal, read });
    return { result, input, read };
  },
  async loadWindow(input, options) {
    const { kind, date } = input;
    if (kind === 'focus') return this.getWindow();
    if (input.channels && !input.channels.length) {
      return { models: [], hasOlder: false, hasNewer: false };
    }
    if (kind === 'replace') {
      return this.loadInitialWindow(input, options);
    }
    if (kind === 'older' || kind === 'newer') {
      return Radio.request('entities', 'fetch:interactions:window:adjacent', input, this.getWindow(), kind, options);
    }
    return Radio.request('entities', 'fetch:interactions:window:toDate', input, this.getWindow(), date, options);
  },
  async loadInitialWindow(input, options) {
    const window = await Radio.request('entities', 'fetch:interactions:window:initial', input, options);
    if (!input.date || input.filterAnchor) return window;
    return Radio.request('entities', 'fetch:interactions:window:toDate', input, window, input.date, options);
  },
  onStart(app, options, { result, input, read }) {
    this.pendingRead = null;
    this.showInteractions({ ...result, models: read.filterModels(result.models) }, input);
    if (read.refresh) this.requestInteractions('replace', read.refresh.date, read.refresh.at);
  },
  handleStartFailure(options, error) {
    const refresh = this.pendingRead?.refresh;
    this.pendingRead = null;
    if (refresh) {
      this.requestInteractions('replace', refresh.date, refresh.at);
      return false;
    }
    const { kind = 'replace', date, at } = options;
    if (kind === 'replace') {
      if (this.collection) this.stopListening(this.collection);
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
    if (this.collection) this.stopListening(this.collection);
    this.collection = null;
    this.filterPosition = null;
    this.pendingRead = null;
    this.getState().set({ request: null, retry: null, hasOlder: false, hasNewer: false });
  },
  onInteractionMessage(data) {
    const { category, resource, payload } = data;
    if (payload.patient?.id !== this.patient.id) return;
    this.pendingRead?.record(data);
    if (category === 'ResourceDeleted') {
      this.reconcileDeletion(resource.id);
      return;
    }
    if (has(payload.attributes, 'occurred_at') || has(payload.attributes, 'expected_at')) this.reconcileTimestampUpdate(resource.id);
  },
  reconcileDeletion(id) {
    const request = this.getState().get('request');
    if (request?.at === id) {
      this.getState().set('request', { ...request, at: null, date: request.date || this.getView().getCurrentDate() });
    }
    if (request || !this.collection?.length) this.reconcileWindow();
  },
  reconcileTimestampUpdate(id) {
    const request = this.getState().get('request');
    // Filter refreshes retain their date when the anchoring row moves away.
    if (request?.date && request.at === id) this.getState().set('request', { ...request, at: null });
    if (request || this.collection?.get(id)) this.reconcileWindow();
  },
  reconcileWindow() {
    const { hasOlder, hasNewer, request } = this.getState().attributes;
    const pending = request || {};
    if (!hasOlder && !hasNewer && !request) return;
    // A changed or deleted cursor no longer bounds the server window. Reconcile through
    // the existing date loader instead of paging from a newly sorted endpoint.
    if (pending.kind === 'replace' || pending.kind === 'focus') {
      this.queueReconciliation(pending.date, pending.at);
      return;
    }
    this.queueReconciliation(pending.date || this.getView().getCurrentDate(), null);
  },
  queueReconciliation(date, at) {
    const read = this.pendingRead;
    if (read) {
      read.refresh = { date: date || read.refresh?.date || read.date, at };
      return;
    }
    this.requestInteractions('replace', date, at);
  },
  getRequest(kind, date, at = this.getState().get('interactionId')) {
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
    if (input.kind === 'focus') {
      view.focusInteraction(this.collection.get(this.getState().get('interactionId')));
      this.getState().set({ request: null, retry: null });
      return;
    }
    this.commitInteractions(models, input);
    if (input.date) view.scrollToDate(input.date);
    this.getState().set({ hasOlder, hasNewer, request: null, retry: null });
  },
  commitInteractions(models, input) {
    const view = this.getView();
    if (input.kind === 'replace') {
      if (this.collection) this.stopListening(this.collection);
      this.collection = Radio.request('entities', 'interactions:collection', models, { comparator: compareInteractions });
      this.listenTo(this.collection, 'change:occurred_at change:expected_at', () => this.collection.sort());
      view.showInteractions(this.collection);
      if (!input.at) view.scrollToLatest();
      return;
    }
    view.updateInteractions(this.collection, models);
  },
});
