import { contains, flatten, keys, map, without } from 'underscore';
import dayjs from 'dayjs';
import { Radio } from 'marionette';

import App from 'js/base/app';

import { InteractionsPageView, InteractionsLoadingView } from './interactions_views';

const GROUP_CHANNELS = {
  messages: ['sms', 'email', 'mail', 'fax'],
  calls: ['voice', 'voicemail', 'video'],
  appointments: ['appointment'],
  visits: ['visit'],
};

export default App.extend({
  onBeforeStart(app, { patient, interactionId }) {
    this.patient = patient;
    this.interactionId = interactionId;
    this.selectedGroups = keys(GROUP_CHANNELS);

    const view = this.setView(new InteractionsPageView({
      model: patient,
      interactionId,
      selectedGroups: this.selectedGroups,
    })).render();

    this.listenTo(view, 'change:filter', this.toggleFilter);
    this.listenTo(view, 'click:loadOlder', this.loadOlder);
    this.listenTo(view, 'date:selected', this.jumpToDate);
    this.listenTo(view, 'beginning:selected', this.jumpToBeginning);
    view.showChildView('content', new InteractionsLoadingView());
    this.showView();
  },
  prepareStart({ patient, interactionId }, { signal }) {
    return Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: patient.id,
      at: interactionId,
    }, { signal });
  },
  onStart(app, options, interactions) {
    if (!this.interactionId) interactions.reset([...interactions.models].reverse());
    this.collection = interactions;
    this.trigger('context:change', { page: 'interactions' });
    this.getView().showInteractions(interactions);
    this.hasOlder = !this.interactionId && interactions.length === 25;
    this.getView().setCanLoadOlder(this.hasOlder);
    this.showView();
  },
  toggleFilter(group) {
    this.filterController?.abort();
    this.isLoadingOlder = false;
    const selected = contains(this.selectedGroups, group);
    if (selected) this.selectedGroups = without(this.selectedGroups, group);
    else this.selectedGroups = [...this.selectedGroups, group];

    this.getView().setSelectedGroups(this.selectedGroups);

    let channels;
    if (this.selectedGroups.length !== keys(GROUP_CHANNELS).length) {
      channels = flatten(map(this.selectedGroups, value => GROUP_CHANNELS[value]));
    }

    if (!channels?.length && this.selectedGroups.length === 0) {
      this.getView().showInteractions(Radio.request('entities', 'interactions:collection'));
      this.hasOlder = false;
      this.getView().setCanLoadOlder(false);
      return;
    }

    this.filterController = new AbortController();
    const signal = this.filterController.signal;

    Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: this.patient.id,
      channels,
      at: this.interactionId,
    }, { signal }).then(interactions => {
      if (signal.aborted || !this.isRunning()) return;
      if (!this.interactionId) interactions.reset([...interactions.models].reverse());
      this.collection = interactions;
      this.getView().showInteractions(interactions);
      this.hasOlder = !this.interactionId && interactions.length === 25;
      this.getView().setCanLoadOlder(this.hasOlder);
    }).catch(error => {
      if (!signal.aborted) this.getView().showError(error);
    });
  },
  loadOlder() {
    if (this.isLoadingOlder || !this.hasOlder) return;
    this.filterController?.abort();
    this.filterController = new AbortController();
    this.isLoadingOlder = true;
    this.getView().setCanLoadOlder(false);

    const signal = this.filterController.signal;
    this.fetchOlder(signal).catch(error => {
      if (!signal.aborted) this.getView().showError(error);
    }).finally(() => {
      this.isLoadingOlder = false;
      if (this.isRunning()) this.getView().setCanLoadOlder(this.hasOlder);
    });
  },
  fetchOlder(signal) {
    const before = this.collection.first()?.id;
    if (!before) return Promise.resolve();
    const channels = flatten(map(this.selectedGroups, value => GROUP_CHANNELS[value]));

    return Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: this.patient.id,
      channels: this.selectedGroups.length === keys(GROUP_CHANNELS).length ? undefined : channels,
      before,
    }, { signal }).then(interactions => {
      if (signal.aborted || !this.isRunning()) return;
      this.collection.reset([...interactions.models].reverse().concat(this.collection.models));
      this.hasOlder = interactions.length === 25;
    });
  },
  jumpToDate(date) {
    if (this.isLoadingOlder || !this.collection.length) return;

    this.filterController?.abort();
    this.filterController = new AbortController();
    const signal = this.filterController.signal;
    this.isLoadingOlder = true;
    this.getView().setCanLoadOlder(false);

    const jump = async() => {
      const oldestDate = () => {
        const oldest = this.collection.first();
        return dayjs(oldest.get('occurred_at') || oldest.get('expected_at')).format('YYYY-MM-DD');
      };
      while (this.hasOlder && oldestDate() > date && !signal.aborted) {
        await this.fetchOlder(signal);
      }
      if (!signal.aborted) this.getView().scrollToDate(date);
    };

    jump().catch(error => {
      if (!signal.aborted) this.getView().showError(error);
    }).finally(() => {
      this.isLoadingOlder = false;
      if (this.isRunning()) this.getView().setCanLoadOlder(this.hasOlder);
    });
  },
  jumpToBeginning() {
    this.jumpToDate('0000-01-01');
  },
  onStop() {
    this.filterController?.abort();
  },
});
