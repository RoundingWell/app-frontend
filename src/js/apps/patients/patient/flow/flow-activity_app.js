import Backbone from 'backbone';
import { Radio } from 'marionette';

import App from 'js/base/app';

import loadActivityInteractions from 'js/apps/patients/shared/interactions/load-activity-interactions';

import { ActivitiesView, FlowActivityLoadingView } from 'js/apps/patients/patient/flow/flow-activity-views';

export default App.extend({
  onBeforeStart() {
    this.showView(new FlowActivityLoadingView());
  },
  prepareStart({ flow, patient }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:flowEvents:collection', flow.id, { signal }),
      loadActivityInteractions({ patientId: patient.id, flowId: flow.id }, { signal }),
    ]);
  },
  onStart(app, { flow, patient }, [activity, interactions]) {
    this.showView(new ActivitiesView({
      collection: new Backbone.Collection([...activity.models, ...interactions]),
      model: flow,
      patientId: patient.id,
    }));
  },
});
