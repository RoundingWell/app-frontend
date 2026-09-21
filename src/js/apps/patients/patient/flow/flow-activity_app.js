import { Radio } from 'marionette';

import App from 'js/base/app';

import { ActivitiesView, FlowActivityLoadingView } from 'js/apps/patients/patient/flow/flow-activity-views';

export default App.extend({
  onBeforeStart() {
    this.showView(new FlowActivityLoadingView());
  },
  prepareStart({ flow }, { signal }) {
    return Radio.request('entities', 'fetch:flowEvents:collection', flow.id, { signal });
  },
  onStart(app, { flow }, activity) {
    this.showView(new ActivitiesView({
      collection: activity,
      model: flow,
    }));
  },
});
