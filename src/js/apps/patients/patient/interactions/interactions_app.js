import Backbone from 'backbone';
import { contains, flatten, keys, map, without } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { InteractionsPageView } from './interactions_views';

const PAGE_SIZE = 25;

export default App.extend({
  createState() {
    return new Backbone.Model({ interactionId: undefined, selectedGroups: [], hasOlder: false, hasNewer: false, request: null, retry: null });
  },
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
    'change:filter': 'toggleFilter',
    'load:edge': 'requestInteractions',
    'retry:paging': 'retryRequest',
    'select:date': 'jumpToDate',
    'select:beginning': 'jumpToBeginning',
  },
  onBeforeStart(app, { patient, interactionId, kind = 'replace', date }) {
    if (!this.getView()) this.showPage({ patient, interactionId });
    this.getState().set({ request: { kind, date }, retry: null, ...(kind === 'replace' && { hasOlder: false, hasNewer: false }) });
    if (kind === 'replace') this.getView().showLoading();
  },
  showPage({ patient, interactionId }) {
    this.patient = patient;
    this.channelGroups = Radio.request('entities', 'interactions:channelGroups');
    this.getState().set({ interactionId, selectedGroups: keys(this.channelGroups) });
    this.showView(new InteractionsPageView({
      model: patient,
      state: this.getState(),
    }));
  },
  async prepareStart({ kind = 'replace', date }, { signal }) {
    const input = this.getRequest(kind, date);
    const result = await this.loadWindow(input, { signal });
    return { result, input };
  },
  async loadWindow(input, { signal }) {
    const { kind, date } = input;
    if (kind === 'focus') return this.getWindow();
    if (input.channels && !input.channels.length) {
      return { models: [], hasOlder: false, hasNewer: false };
    }
    if (kind === 'replace') {
      const window = await Radio.request('entities', 'fetch:interactions:window:initial', input, { signal });
      if (date) return Radio.request('entities', 'fetch:interactions:window:toDate', input, window, date, { signal });
      return window;
    }
    if (kind === 'older' || kind === 'newer') {
      return Radio.request('entities', 'fetch:interactions:window:adjacent', input, this.getWindow(), kind, { signal });
    }
    return Radio.request('entities', 'fetch:interactions:window:toDate', input, this.getWindow(), date, { signal });
  },
  onStart(app, options, { result, input }) {
    this.showInteractions(result, input);
  },
  handleStartFailure(options, error) {
    const { kind = 'replace', date } = options;
    if (kind === 'replace') {
      this.collection = null;
      this.getView().showError();
    }
    this.getState().set({ request: null, retry: { kind, date } });
    addError(error);
    return false;
  },
  onBeforeDestroyView() {
    this.stop();
  },
  onStop() {
    this.collection = null;
    this.getState().set({ request: null, retry: null, hasOlder: false, hasNewer: false });
  },
  getRequest(kind, date) {
    const selectedGroups = this.getState().get('selectedGroups');
    const channels = flatten(map(selectedGroups, group => this.channelGroups[group]));
    return {
      kind,
      date,
      patientId: this.patient.id,
      channels: selectedGroups.length === keys(this.channelGroups).length ? undefined : channels,
      at: this.getState().get('interactionId'),
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
    const selectedGroups = this.getState().get('selectedGroups');
    this.getState().set({
      selectedGroups: contains(selectedGroups, group) ? without(selectedGroups, group) : [...selectedGroups, group],
      interactionId: undefined,
    });
    this.requestInteractions('replace');
  },
  requestInteractions(kind, date) {
    const options = { kind, date };
    return this.restart(options).catch(error => this.handleStartFailure(options, error));
  },
  retryRequest() {
    const { kind, date } = this.getState().get('retry');
    this.requestInteractions(kind, date);
  },
  jumpToDate(date) {
    // A navigation intent supersedes paging, including a pending filter refresh.
    const kind = this.getState().get('request')?.kind === 'replace' ? 'replace' : 'date';
    if (kind === 'date' && !this.collection) return;
    this.requestInteractions(kind, date);
  },
  jumpToBeginning() {
    this.jumpToDate('0000-01-01');
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
      this.collection = Radio.request('entities', 'interactions:collection', models);
      view.showInteractions(this.collection);
      if (!input.at) view.scrollToLatest();
      return;
    }
    view.updateInteractions(this.collection, models);
  },
});
