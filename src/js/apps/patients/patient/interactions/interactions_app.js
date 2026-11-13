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
const RECONCILIATION_DELAY = 500;

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
    this.presentation = Promise.withResolvers();
    this.patient = patient;
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.channelGroups = Radio.request('entities', 'interactions:channelGroups');
    this.getState().set({ interactionId, selectedGroups: keys(this.channelGroups), contentStatus: 'loading' });
    this.showView(new InteractionsPageView({
      model: patient,
      state: this.getState(),
    }));
  },
  async prepareStart({ kind = 'replace', date, at, reconcile }, { signal }) {
    const input = this.getRequest(kind, date, at);
    if (at) input.filterAnchor = true;
    if (kind === 'replace' && !this.collection && !input.at && !date) input.date = dayjs().format('YYYY-MM-DD');
    const read = this.pendingRead = new InteractionWindowRead(input.date);
    const options = { signal, read };
    const prepared = reconcile ? await this.repairAndPage(input, reconcile, options) : { result: await this.loadWindow(input, options) };
    return { ...prepared, input, read };
  },
  async repairAndPage(input, reconcile, options) {
    const replacement = { ...input, ...reconcile, kind: 'replace', filterAnchor: !!reconcile.at };
    const window = this.getLiveWindow(await this.loadInitialWindow(replacement, options), options.read);
    options.signal.throwIfAborted();
    const result = window[input.kind === 'newer' ? 'hasNewer' : 'hasOlder'] ?
      await Radio.request('entities', 'fetch:interactions:window:adjacent', input, window, input.kind, options) :
      window;
    return { result, repaired: { window, input: replacement } };
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
  onStart(app, options, { result, input, read, repaired }) {
    this.pendingRead = null;
    // Restore the repaired viewport before prepending/appending its adjacent page.
    if (repaired) this.showInteractions(this.getLiveWindow(repaired.window, read), repaired.input);
    this.showInteractions(this.getLiveWindow(result, read), input);
    this.presentation.resolve(true);
    if (read.refresh) this.scheduleReconciliation(read.refresh);
  },
  getLiveWindow(window, read) {
    const models = read.filterModels(window.models);
    return { ...window, models, hasOlder: !!models.length && window.hasOlder, hasNewer: !!models.length && window.hasNewer };
  },
  initialPresentation() {
    return this.presentation.promise;
  },
  handleStartFailure(options, error) {
    const refresh = this.pendingRead?.refresh;
    this.pendingRead = null;
    if (refresh) {
      this.getState().set('request', null);
      this.scheduleReconciliation(refresh);
      return false;
    }
    const { kind = 'replace', date, at } = options;
    if (kind === 'replace') {
      if (this.collection) this.stopListening(this.collection);
      this.collection = null;
      this.getView().showError();
    }
    this.getState().set({ request: null, retry: { kind, date, at, reconcile: options.reconcile } });
    addError(error);
    this.presentation.resolve(false);
    return false;
  },
  onBeforeDestroyView() {
    // A failed initial start can retain the view while the app is inactive.
    this.cancelReconciliation();
    this.presentation.resolve(false);
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.stop();
  },
  onStop() {
    this.cancelReconciliation();
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    if (this.collection) this.stopListening(this.collection);
    this.presentation?.resolve(false);
    this.presentation = null;
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
    this.invalidateAnchor(id, true);
    const request = this.getState().get('request');
    if (request || !this.collection?.length) this.reconcileWindow();
  },
  reconcileTimestampUpdate(id) {
    this.invalidateAnchor(id, false);
    const request = this.getState().get('request');
    if (request || this.collection?.get(id)) this.reconcileWindow();
  },
  invalidateAnchor(id, deleted) {
    const pending = this.reconciliation || this.getState().get('request');
    if (pending?.at !== id) return;
    // Explicit ID navigation follows a moved row; date navigation retains its day.
    if (!deleted && !pending.date) return;
    const next = { ...pending, at: null, date: pending.date || this.getView().getCurrentDate() };
    if (this.reconciliation) this.reconciliation = next;
    else this.getState().set('request', next);
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
    this.scheduleReconciliation(this.reconciliation || { date, at });
  },
  scheduleReconciliation(refresh) {
    this.reconciliation = refresh;
    // Events never extend the deadline. Each completed read gets a quiet interval
    // in which navigation and automatic edge paging can take precedence.
    if (this.reconciliationTimer) return;
    this.reconciliationTimer = setTimeout(() => {
      const latest = this.cancelReconciliation();
      this.requestInteractions('replace', latest.date, latest.at);
    }, RECONCILIATION_DELAY);
  },
  cancelReconciliation() {
    clearTimeout(this.reconciliationTimer);
    this.reconciliationTimer = null;
    const refresh = this.reconciliation;
    this.reconciliation = null;
    return refresh;
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
  hasPendingReplacement() {
    return this.getState().get('request')?.kind === 'replace' || !!this.reconciliation;
  },
  navigateToInteraction(interactionId) {
    const changedGroups = this.enableInteractionGroup(interactionId);
    this.getState().set({ interactionId });
    const request = this.getState().get('request');
    const pendingFilter = this.hasPendingReplacement();
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
  requestInteractions(kind, date, at, retryReconciliation) {
    const queued = this.cancelReconciliation() || retryReconciliation;
    // A delayed refresh may have invalidated the current paging cursor.
    const reconcile = (kind === 'older' || kind === 'newer') && queued;
    const options = { kind, date, at, ...(reconcile && { reconcile }) };
    return this.restart(options).catch(error => this.handleStartFailure(options, error));
  },
  retryRequest() {
    const { kind, date, at, reconcile } = this.getState().get('retry');
    this.requestInteractions(kind, date, at, reconcile);
  },
  jumpToDate(date) {
    // A navigation intent supersedes paging, including a pending filter refresh.
    const kind = !this.collection || this.hasPendingReplacement() ? 'replace' : 'date';
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
