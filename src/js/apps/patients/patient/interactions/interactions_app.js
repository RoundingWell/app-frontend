import { contains, flatten, keys, map, without } from 'underscore';
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
    this.collection = interactions;
    this.trigger('context:change', { page: 'interactions' });
    this.getView().showInteractions(interactions);
    this.getView().setCanLoadOlder(!this.interactionId && interactions.length === 25);
    this.showView();
  },
  toggleFilter(group) {
    this.filterController?.abort();
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
      this.collection = interactions;
      this.getView().showInteractions(interactions);
      this.getView().setCanLoadOlder(!this.interactionId && interactions.length === 25);
    }).catch(error => {
      if (!signal.aborted) this.getView().showError(error);
    });
  },
  loadOlder() {
    const before = this.collection.last()?.id;
    if (!before) return;

    this.filterController?.abort();
    this.filterController = new AbortController();
    const signal = this.filterController.signal;
    const channels = flatten(map(this.selectedGroups, value => GROUP_CHANNELS[value]));

    this.getView().setCanLoadOlder(false);
    Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: this.patient.id,
      channels: this.selectedGroups.length === keys(GROUP_CHANNELS).length ? undefined : channels,
      before,
    }, { signal }).then(interactions => {
      if (signal.aborted || !this.isRunning()) return;
      this.collection.add(interactions.models);
      this.getView().setCanLoadOlder(interactions.length === 25);
    }).catch(error => {
      if (!signal.aborted) this.getView().showError(error);
    });
  },
  onStop() {
    this.filterController?.abort();
  },
});
