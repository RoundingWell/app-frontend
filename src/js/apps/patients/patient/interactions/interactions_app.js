import Backbone from 'backbone';
import dayjs from 'dayjs';
import { contains, flatten, has, keys, map, without } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { compareInteractions } from 'js/entities-service/entities/interactions';
import InteractionWindowRead from 'js/entities-service/interaction-window-read';

import ComposerView from 'js/apps/patients/shared/messaging/composer/composer_view';
import intl from 'js/i18n';
import createComposerAdapter from 'js/apps/patients/shared/messaging/composer-adapter';
import RecoveryView from 'js/apps/patients/shared/messaging/recovery_view';
import { prototypeTarget } from 'js/entities-service/messaging-prototype';
import { isPrototypeTarget } from 'js/entities-service/messaging-prototype/contract';
import { consumeComposerRequest } from 'js/apps/patients/shared/messaging/composer-intent';
import { pendingConfirmations, acknowledgeConfirmations } from 'js/entities-service/messaging-prototype/confirmed-sends';
import { extendConnectedWindow } from 'js/entities-service/messaging-prototype/connected-window';
import { comparePositions, position } from 'js/entities-service/messaging-prototype/history';

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
    'message:submitting': 'retainReadingPoint',
  },
  onBeforeStart(app, { patient, interactionId, focusComposer, kind = 'replace', date, at }) {
    if (!this.getView()) this.showPage({ patient, interactionId, focusComposer });
    const anchor = at === undefined ? this.getState().get('interactionId') : at;
    this.getState().set({ request: { kind, date, at: anchor }, retry: null, ...(kind === 'replace' && { hasOlder: false, hasNewer: false }) });
    if (kind === 'replace') this.getView().showLoading();
  },
  showPage({ patient, interactionId, focusComposer }) {
    this.patient = patient;
    this.unloadedInteractions = new Set();
    this.deletedInteractions = new Set();
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.channelGroups = Radio.request('entities', 'interactions:channelGroups');
    this.getState().set({ interactionId, selectedGroups: keys(this.channelGroups), contentStatus: 'loading' });
    this.showView(new InteractionsPageView({
      model: patient,
      state: this.getState(),
    }));
    this.nativeMessaging = isPrototypeTarget(prototypeTarget(patient.id));
    this.messagingAdapter = this.nativeMessaging ? createComposerAdapter({ patient }) : null;
    this.nativeFocusRequested = focusComposer || (this.nativeMessaging && consumeComposerRequest(patient.id));
    if (this.nativeMessaging) {
      this.listenTo(Radio.channel('messaging-prototype'), 'interaction:recorded', this.onRecordedInteraction);
      this.listenTo(Radio.channel('messaging-prototype'), 'composer:requested', this.onComposerRequested);
      this.getView().showChildView('recovery', new RecoveryView({ patientId: patient.id }));
    }
  },
  mountComposer() {
    if (!this.messagingAdapter || this.getView().getChildView('composer')) return;
    const adapter = this.messagingAdapter;
    this.getView().showChildView('composer', new ComposerView({
      adapter, patientId: this.patient.id, actionId: null,
      sessionScope: adapter.sessionScope, focus: this.nativeFocusRequested,
    }));
  },
  focusComposer() {
    const composer = this.getView()?.getChildView('composer');
    this.nativeFocusRequested = !composer;
    if (composer && !this.getState().get('hasNewer')) this.getView().followComposer();
    composer?.focusComposer();
  },
  async prepareStart({ kind = 'replace', date, at, reconcile }, { signal }) {
    if (this.nativeMessaging) await this.messagingAdapter.ready;
    signal.throwIfAborted();
    const input = this.getInitialRequest(kind, date, at);
    const read = this.pendingRead = new InteractionWindowRead(input.date);
    const options = { signal, read };
    const prepared = reconcile ? await this.repairAndPage(input, reconcile, options) : { result: await this.loadWindow(input, options) };
    return { ...prepared, input, read };
  },
  getInitialRequest(kind, date, at) {
    const input = this.getRequest(kind, date, at);
    if (at) input.filterAnchor = true;
    if (kind === 'replace' && !this.collection && !input.at && !date && !this.nativeFocusRequested) input.date = dayjs().format('YYYY-MM-DD');
    return input;
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
    this.mountComposer();
    // Restore the repaired viewport before prepending/appending its adjacent page.
    if (repaired) this.showInteractions(this.getLiveWindow(repaired.window, read), repaired.input);
    this.showInteractions(this.getLiveWindow(result, read), input);
    this.rememberLoadedPositions();
    if (this.nativeFocusRequested) {
      if (!this.getState().get('hasNewer')) this.getView().followComposer();
      this.getView().getChildView('composer')?.focusComposer();
      this.nativeFocusRequested = false;
    }
    if (read.refresh) this.scheduleReconciliation(read.refresh);
    if (this.nativeMessaging) this.synchronizeConfirmed();
  },
  getLiveWindow(window, read) {
    const models = read.filterModels(window.models);
    return { ...window, models, hasOlder: !!models.length && window.hasOlder, hasNewer: !!models.length && window.hasNewer };
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
    return false;
  },
  onBeforeDestroyView() {
    // A failed initial prepare never activates onStop's cleanup path.
    this.releaseComposer();
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.stop();
  },
  onStop() {
    this.localController?.abort();
    this.synchronizing = false;
    this.syncAgain = false;
    this.localRead = null;
    clearTimeout(this.unloadedRetry);
    this.unloadedInteractions.clear();
    this.releaseComposer();
    this.cancelReconciliation();
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    if (this.collection) this.stopListening(this.collection);
    this.collection = null;
    this.filterPosition = null;
    this.pendingRead = null;
    this.getState().set({ request: null, retry: null, hasOlder: false, hasNewer: false });
  },
  releaseComposer() {
    this.messagingAdapter?.dispose?.();
    this.messagingAdapter = null;
    this.stopListening(Radio.channel('messaging-prototype'));
  },
  onInteractionMessage(data) {
    const { category, resource, payload } = data;
    if (payload.patient?.id !== this.patient.id) return;
    this.retainReadingPoint();
    this.pendingRead?.record(data);
    this.localRead?.record(data);
    if (category === 'ResourceDeleted') {
      this.onInteractionDeleted(resource.id);
      return;
    }
    this.queueUnloadedInteraction(category, resource.id);
    if (has(payload.attributes, 'occurred_at') || has(payload.attributes, 'expected_at')) this.reconcileTimestampUpdate(resource.id);
  },
  onInteractionDeleted(id) {
    this.deletedInteractions.add(id);
    this.unloadedInteractions.delete(id);
    if (this.nativeMessaging) acknowledgeConfirmations(this.patient.id, [{ id }]);
    this.reconcileDeletion(id);
  },
  queueUnloadedInteraction(category, id) {
    if (!this.nativeMessaging || this.collection?.get(id) || this.deletedInteractions.has(id)) return;
    if (!contains(['ResourceCreated', 'InteractionCompleted', 'InteractionScheduled', 'InteractionCancelled', 'MetadataUpdated'], category)) return;
    this.unloadedInteractions.add(id);
    this.synchronizeConfirmed();
  },
  reconcileDeletion(id) {
    this.invalidateAnchor(id, true);
    const request = this.getState().get('request');
    if (request || !this.collection?.length) this.reconcileWindow();
  },
  reconcileTimestampUpdate(id) {
    if (this.nativeMessaging && this.unchangedLoadedPosition(id)) return;
    this.invalidateAnchor(id, false);
    const request = this.getState().get('request');
    if (request || this.collection?.get(id)) this.reconcileWindow();
  },
  rememberLoadedPositions() {
    if (!this.nativeMessaging) return;
    this.loadedPositions = new Map(this.collection.models.map(model => [model.id, position(model)]));
  },
  unchangedLoadedPosition(id) {
    const model = this.collection?.get(id);
    const previous = this.loadedPositions?.get(id);
    return !!model && !!previous && !comparePositions(previous, position(model));
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
    this.localController?.abort();
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
      this.collection = Radio.request('entities', 'interactions:collection', models, { comparator: this.nativeMessaging ? (left, right) => comparePositions(position(left), position(right)) : compareInteractions });
      this.listenTo(this.collection, 'change:occurred_at change:expected_at', () => this.collection.sort());
      view.showInteractions(this.collection);
      if (!input.at) view.scrollToLatest();
      return;
    }
    view.updateInteractions(this.collection, models);
  },
  onComposerRequested(patientId) {
    if (patientId !== this.patient.id) return;
    consumeComposerRequest(patientId);
    this.focusComposer();
  },
  retainReadingPoint() {
    if (!this.nativeMessaging || !this.collection || this.getState().get('request')) return;
    this.getView().retainReadingPoint();
  },
  onRecordedInteraction({ patientId }) {
    if (patientId !== this.patient.id || !this.isRunning()) return;
    this.retainReadingPoint();
    this.synchronizeConfirmed();
  },
  async synchronizeConfirmed() {
    if (this.synchronizing) {
      this.syncAgain = true;
      return;
    }
    const confirmed = this.pendingLocalRecords();
    if (!confirmed) return;
    this.synchronizing = true;
    const controller = this.localController = new AbortController();
    const input = this.getRequest('local');
    const read = this.localRead = new InteractionWindowRead();
    try {
      const required = await this.readUnloadedInteractions(confirmed, input, controller.signal, read);
      if (!required.length) return;
      const window = await extendConnectedWindow(this.getWindow(), required, async page => {
        const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', { ...input, at: undefined, ...page }, { signal: controller.signal, read });
        return collection.models;
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      this.commitSynchronizedWindow(window);
    } catch {
      if (!controller.signal.aborted) this.retryUnloadedInteractions();
    } finally {
      if (this.localController === controller) this.finishSynchronization();
    }
  },
  async readUnloadedInteractions(confirmed, input, signal, read) {
    const required = [...confirmed];
    for (const id of [...this.unloadedInteractions]) {
      if (this.collection.get(id)) {
        this.unloadedInteractions.delete(id);
        continue;
      }
      const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', { patientId: this.patient.id, at: id, limit: 1 }, { signal, read });
      signal.throwIfAborted();
      if (this.deletedInteractions.has(id)) continue;
      const model = collection.get(id);
      if (!model?.getTimestamp()) throw new Error('The new interaction is not readable yet.');
      if (!input.channels || contains(input.channels, model.get('channel'))) required.push(model);
      else this.unloadedInteractions.delete(id);
    }
    return required;
  },
  commitSynchronizedWindow(window) {
    if (window.models.some(model => this.deletedInteractions.has(model.id))) throw new Error('An interaction was deleted during refresh.');
    this.getView().updateInteractions(this.collection, window.models, { preserveAnchor: true });
    this.getState().set({ hasOlder: window.hasOlder, hasNewer: window.hasNewer });
    this.rememberLoadedPositions();
    window.models.forEach(model => this.unloadedInteractions.delete(model.id));
    this.unloadedAttempts = 0;
    clearTimeout(this.unloadedRetry);
    acknowledgeConfirmations(this.patient.id, window.models);
    this.getView().getRegion('recorded').empty();
  },
  retryUnloadedInteractions() {
    this.showRecordedStatus(true);
    if (!this.unloadedInteractions.size || (this.unloadedAttempts || 0) >= 2) return;
    this.unloadedAttempts = (this.unloadedAttempts || 0) + 1;
    clearTimeout(this.unloadedRetry);
    this.unloadedRetry = setTimeout(() => this.synchronizeConfirmed(), RECONCILIATION_DELAY);
  },
  pendingLocalRecords() {
    if (!this.collection || this.getState().get('request')) return;
    acknowledgeConfirmations(this.patient.id, this.collection.models);
    const visible = this.visibleConfirmations(pendingConfirmations(this.patient.id));
    if (!visible.length && !this.unloadedInteractions.size) return;
    return visible;
  },
  visibleConfirmations(required) {
    if (!required.length) {
      this.getView().getRegion('recorded').empty();
      return [];
    }
    if (contains(this.getState().get('selectedGroups'), 'messages')) return required;
    this.showRecordedStatus(false);
    return [];
  },
  finishSynchronization() {
    this.synchronizing = false;
    this.localRead = null;
    if (this.syncAgain && this.isRunning()) {
      this.syncAgain = false;
      this.synchronizeConfirmed();
    }
  },
  showRecordedStatus(error) {
    const status = new View({
      template: hbs`<p role="status">{{ text }}</p>{{#if error}}<button class="button button--text js-retry-local" type="button">{{ retry }}</button>{{/if}}`,
      templateContext: { text: error ? intl.patients.messaging.timelineRefreshFailed : intl.patients.messaging.recordedInOtherWindow, error, retry: intl.patients.messaging.retryRefresh },
      ui: { retry: '.js-retry-local' }, triggers: { 'click @ui.retry': 'retry:local' },
    });
    this.listenTo(status, 'retry:local', this.synchronizeConfirmed);
    this.getView().showChildView('recorded', status);
  },
});
