import Backbone from 'backbone';
import { contains, find, flatten, keys, map, without } from 'underscore';
import dayjs from 'dayjs';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { InteractionsPageView } from './interactions_views';

const GROUP_CHANNELS = {
  messages: ['sms', 'email', 'mail', 'fax', 'portal'],
  calls: ['voice', 'voicemail', 'video'],
  appointments: ['appointment'],
  visits: ['visit'],
};

const PAGE_SIZE = 25;

export default App.extend({
  createState() {
    return new Backbone.Model();
  },
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
    'change:filter': 'toggleFilter',
    'load:edge': 'loadEdge',
    'retry:paging': 'retryRequest',
    'date:selected': 'jumpToDate',
    'beginning:selected': 'jumpToBeginning',
  },
  onBeforeStart(app, { patient, interactionId, kind = 'replace', date }) {
    if (!this.getView()) {
      this.patient = patient;
      this.interactionId = interactionId;
      this.selectedGroups = keys(GROUP_CHANNELS);
      this.getState().set({ interactionId });
      this.setView(new InteractionsPageView({
        model: patient,
        selection: this.getState(),
        selectedGroups: this.selectedGroups,
      })).render();
      this.showView();
    }
    this.isLoading = true;
    this.lastRequest = { kind, date };
    if (kind === 'replace') {
      this.hasOlder = false;
      this.hasNewer = false;
      this.getView().showLoading();
    }
    this.getView().setPaging({ hasOlder: this.hasOlder, hasNewer: this.hasNewer, loading: true });
  },
  async prepareStart({ kind = 'replace', date }, { signal }) {
    const input = this.getRequest(kind, date);
    const result = await this.loadInteractions(input, { signal });
    signal.throwIfAborted();
    return { result, input };
  },
  onStart(app, options, { result, input }) {
    this.showInteractions(result, input);
    this.triggerMethod('context:change', { page: 'interactions' });
  },
  handleStartFailure({ kind = 'replace' }, error) {
    this.isLoading = false;
    const view = this.getView();
    if (kind === 'replace') {
      this.collection = null;
      this.hasOlder = false;
      this.hasNewer = false;
      view.setPaging({ hasOlder: false, hasNewer: false, loading: false });
      view.showError();
    } else {
      view.showPagingError();
    }
    addError(error);
    return false;
  },
  onBeforeDestroyView() {
    this.stop();
  },
  onStop() {
    this.collection = null;
    this.hasOlder = false;
    this.hasNewer = false;
    this.isLoading = false;
    this.lastRequest = null;
  },
  getRequest(kind, date) {
    const channels = flatten(map(this.selectedGroups, group => GROUP_CHANNELS[group]));
    return {
      kind,
      date,
      patientId: this.patient.id,
      channels: this.selectedGroups.length === keys(GROUP_CHANNELS).length ? undefined : channels,
      at: this.interactionId,
      limit: PAGE_SIZE,
    };
  },
  enableInteractionGroup(interactionId) {
    const target = Radio.request('entities', 'interactions:model', interactionId);
    const group = target && find(keys(GROUP_CHANNELS), key => contains(GROUP_CHANNELS[key], target.get('channel')));
    if (!group || contains(this.selectedGroups, group)) return false;
    this.selectedGroups = [...this.selectedGroups, group];
    this.getView().setSelectedGroups(this.selectedGroups);
    return true;
  },
  navigateToInteraction(interactionId) {
    const changedGroups = interactionId && this.enableInteractionGroup(interactionId);
    this.interactionId = interactionId;
    this.getState().set({ interactionId });
    const pendingFilter = this.isLoading && this.lastRequest.kind === 'replace';
    const loaded = this.collection && (!interactionId || this.collection.get(interactionId));
    if (!loaded || pendingFilter || changedGroups) return this.requestInteractions('replace');
    this.getView().focusInteraction(this.collection.get(interactionId));
    return Promise.resolve(true);
  },
  toggleFilter(group) {
    if (contains(this.selectedGroups, group)) this.selectedGroups = without(this.selectedGroups, group);
    else this.selectedGroups = [...this.selectedGroups, group];
    this.getView().setSelectedGroups(this.selectedGroups);
    this.interactionId = undefined;
    this.getState().set({ interactionId: undefined });
    this.requestInteractions('replace');
  },
  requestInteractions(kind, date) {
    const options = { kind, date };
    return this.restart(options).catch(error => this.handleStartFailure(options, error));
  },
  retryRequest() {
    if (this.isLoading || !this.lastRequest) return;
    this.requestInteractions(this.lastRequest.kind, this.lastRequest.date);
  },
  loadEdge(direction) {
    if (this.isLoading) return;
    if (direction === 'older' && !this.hasOlder) return;
    if (direction === 'newer' && !this.hasNewer) return;
    this.requestInteractions(direction);
  },
  jumpToDate(date) {
    // A navigation intent supersedes paging, including a pending filter refresh.
    const kind = this.isLoading && this.lastRequest.kind === 'replace' ? 'replace' : 'date';
    if (kind === 'date' && !this.collection?.length) return;
    this.requestInteractions(kind, date);
  },
  jumpToBeginning() {
    this.jumpToDate('0000-01-01');
  },
  async loadInteractions(input, { signal }) {
    let result = { models: [...this.collection?.models || []], hasOlder: this.hasOlder, hasNewer: this.hasNewer };
    if (input.channels && !input.channels.length) {
      return { collection: Radio.request('entities', 'interactions:collection'), hasOlder: false, hasNewer: false };
    }
    if (input.kind === 'replace') {
      result = await this.loadInitialInteractions(input, signal);
      if (!input.date) return result;
    }
    if (this.loadsNewer(input, result)) return this.loadNewerInteractions(input, signal, result);
    return this.loadEarlierInteractions(input, signal, result);
  },
  async loadInitialInteractions(input, signal) {
    const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', input, { signal });
    signal.throwIfAborted();
    if (!input.at) collection.reset([...collection.models].reverse());
    return {
      collection,
      models: [...collection.models],
      hasOlder: input.at ? !!collection.length : collection.length === PAGE_SIZE,
      hasNewer: !!input.at && !!collection.length,
    };
  },
  loadsNewer(input, { models, hasNewer }) {
    if (input.kind === 'newer') return true;
    if (!input.date || !hasNewer || !models.length) return false;
    const newest = models[models.length - 1];
    return input.date > dayjs(newest.get('occurred_at') || newest.get('expected_at')).format('YYYY-MM-DD');
  },
  async loadNewerInteractions(input, signal, result) {
    let { models, hasNewer } = result;
    while (hasNewer && models.length) {
      const newest = models[models.length - 1];
      if (input.date && dayjs(newest.get('occurred_at') || newest.get('expected_at')).format('YYYY-MM-DD') >= input.date) break;
      const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', {
        patientId: input.patientId,
        channels: input.channels,
        after: newest.id,
        limit: PAGE_SIZE,
      }, { signal });
      signal.throwIfAborted();
      const newer = collection.filter(model => !contains(models, model));
      models = models.concat(newer);
      hasNewer = !!newer.length && collection.length === PAGE_SIZE;
      if (input.kind === 'newer') break;
    }
    return { ...result, models, hasNewer };
  },
  async loadEarlierInteractions(input, signal, result) {
    let { models, hasOlder } = result;
    while (hasOlder && models.length) {
      const oldest = models[0];
      const oldestDate = dayjs(oldest.get('occurred_at') || oldest.get('expected_at')).format('YYYY-MM-DD');
      // Fetch past the target day so a page boundary cannot hide its first items.
      if (input.date && oldestDate < input.date) break;
      const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', {
        patientId: input.patientId,
        channels: input.channels,
        before: oldest.id,
        limit: PAGE_SIZE,
      }, { signal });
      signal.throwIfAborted();
      const earlier = collection.filter(model => !contains(models, model));
      models = [...earlier].reverse().concat(models);
      hasOlder = !!earlier.length && collection.length === PAGE_SIZE;
      if (input.kind === 'older') break;
    }
    return { ...result, models, hasOlder };
  },
  showInteractions({ collection, models, hasOlder, hasNewer }, input) {
    this.isLoading = false;
    this.hasOlder = hasOlder;
    this.hasNewer = hasNewer;
    const view = this.getView();
    if (collection) {
      if (models) collection.set(models);
      this.collection = collection;
      view.showInteractions(collection);
      if (!input.at) view.scrollToLatest();
    } else {
      const position = view.getScrollPosition();
      const prepend = models[0] !== this.collection.first();
      this.collection.set(models);
      view.restoreScrollPosition(position, prepend);
    }
    if (input.date) view.scrollToDate(input.date);
    view.setPaging({ hasOlder, hasNewer, loading: false });
  },
});
