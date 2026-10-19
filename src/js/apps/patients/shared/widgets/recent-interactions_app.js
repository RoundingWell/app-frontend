import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { isPatientInteractionMessage } from 'js/apps/patients/shared/interactions/live-updates';

import { RecentInteractionsView } from './recent-interactions_views';

export default App.extend({
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
  },
  onBeforeStart(app, { patient }) {
    this.patient = patient;
    if (this.getView()) return;
    this.showView(new RecentInteractionsView({ model: patient }));
    this.getView().showLoading();
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
  },
  prepareStart({ patient }, { signal }) {
    return Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: patient.id, limit: 3,
    }, { signal });
  },
  onStart(app, options, collection) {
    if (this.collection) {
      this.collection.set(collection.models);
      return;
    }
    this.collection = collection;
    this.getView().showInteractions(collection);
  },
  onInteractionMessage(message) {
    if (!isPatientInteractionMessage(message, this.patient)) return;
    this.restart({ patient: this.patient }).catch(error => this.handleStartFailure(error));
  },
  onStop() {
    this.collection = null;
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
  },
  handleStartFailure(error) {
    if (!this.collection) this.getView().showError();
    addError(error);
    return false;
  },
  onBeforeDestroyView() {
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.stop();
  },
});
