import Radio from 'backbone.radio';

import App from 'js/base/app';

import { ActivitiesView, FlowActivityLoadingView } from 'js/apps/patients/patient/flow/flow-activity-views';

export default App.extend({
  onBeforeStart() {
    this.getRegion().show(new FlowActivityLoadingView());
  },
  beforeStart({ flow }) {
    return Radio.request('entities', 'fetch:flowEvents:collection', flow.id);
  },
  onStart({ flow }, activity) {
    this.showView(new ActivitiesView({
      collection: activity,
      model: flow,
    }));
  },
});
