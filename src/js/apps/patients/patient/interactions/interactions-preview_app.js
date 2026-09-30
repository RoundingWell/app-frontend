import { Radio } from 'marionette';

import createLatestRequest from 'js/utils/latest-request';

import App from 'js/base/app';

import { InteractionsPreviewView } from './interactions_views';

export default App.extend({
  onBeforeStart(app, { patient, actionId }) {
    this.releaseRun();
    const view = this.setView(new InteractionsPreviewView({ model: patient, actionId })).render();
    this.listenTo(view, 'before:destroy', () => this.releaseRun(view));
    this.requests = createLatestRequest({
      load: (input, options) => Radio.request('entities', 'fetch:interactions:collection:byPatient', input, options),
      commit: collection => view.showInteractions(collection),
      fail: () => view.showError(),
    });
    view.showLoading();
    this.showView();
  },
  prepareStart({ patient, actionId }, { signal }) {
    return this.requests.run({ patientId: patient.id, actionId, limit: 3 }, { signal });
  },
  onStop() {
    this.releaseRun();
  },
  onBeforeDestroy() {
    this.releaseRun();
  },
  releaseRun(view = this.getView()) {
    this.requests?.dispose();
    if (view) this.stopListening(view);
    this.requests = null;
  },
});
