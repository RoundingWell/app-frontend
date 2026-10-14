import Backbone from 'backbone';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import intl from 'js/i18n';

import App from 'js/base/app';

import { ActivitiesView, FlowActivityLoadingView } from 'js/apps/patients/patient/flow/flow-activity-views';

export default App.extend({
  onBeforeStart() {
    this.showView(new FlowActivityLoadingView());
  },
  prepareStart({ flow, patient }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:flowEvents:collection', flow.id, { signal }),
      Radio.request('entities', 'fetch:interactions:models:forActivity', { patientId: patient.id, flowId: flow.id }, { signal })
        .then(models => ({ models }), error => {
          signal.throwIfAborted();
          return { models: [], error };
        }),
    ]);
  },
  onStart(app, { flow, patient }, [activity, { models: interactions, error }]) {
    this.showView(new ActivitiesView({
      collection: new Backbone.Collection([...activity.models, ...interactions]),
      model: flow,
      patientId: patient.id,
    }));

    if (error) {
      addError(error);
      Radio.request('alert', 'show:error', intl.patients.shared.interactions.interactionsStatusViews.loadError);
    }
  },
});
