import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { RecentInteractionsView } from './recent-interactions_views';

export default App.extend({
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
  },
  onBeforeStart(app, { patient }) {
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
  handleStartFailure(error) {
    this.getView().showError();
    addError(error);
    return false;
  },
  onBeforeDestroyView() {
    this.stop();
  },
});
