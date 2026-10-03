import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { InteractionsPreviewView } from './interactions_views';

export default App.extend({
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
  },
  onBeforeStart(app, { patient, actionId }) {
    if (!this.getView()) {
      this.setView(new InteractionsPreviewView({ model: patient, actionId })).render();
      this.showView();
    }
    this.getView().showLoading();
  },
  prepareStart({ patient, actionId }, { signal }) {
    return Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: patient.id, actionId, limit: 3,
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
