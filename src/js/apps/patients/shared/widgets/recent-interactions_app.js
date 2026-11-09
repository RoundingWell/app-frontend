import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { RecentInteractionsView } from './recent-interactions_views';

export default App.extend({
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
  },
  onBeforeStart(app, { patient }) {
    this.patient = patient;
    if (this.getView()) return;
    this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.showView(new RecentInteractionsView({ model: patient }));
    this.getView().showLoading();
  },
  prepareStart({ patient }, { signal }) {
    return Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: patient.id, limit: 3,
    }, { signal });
  },
  onStart(app, options, collection) {
    this.getView().showInteractions(collection);
  },
  onInteractionMessage(message) {
    if (message.payload?.patient?.id !== this.patient.id) return;
    this.restart({ patient: this.patient }).catch(error => this.handleStartFailure(error));
  },
  onStop() {
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
  },
  handleStartFailure(error) {
    this.getView().showError();
    addError(error);
    return false;
  },
  onBeforeDestroyView() {
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
    this.stop();
  },
});
