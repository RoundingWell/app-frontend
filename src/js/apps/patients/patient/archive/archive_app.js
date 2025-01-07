import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import { LayoutView, ListView } from 'js/views/patients/patient/archive/archive_views';

export default App.extend({
  onBeforeStart({ patient }) {
    this.showView(new LayoutView({ model: patient }));
    this.getRegion('content').startPreloader();
  },
  beforeStart({ patient }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();
    const filter = { states: states.groupByDone().done.getFilterIds() };

    return [
      Radio.request('entities', 'fetch:actions:collection:byPatient', { patientId: patient.id, filter }),
      Radio.request('entities', 'fetch:flows:collection:byPatient', { patientId: patient.id, filter }),
    ];
  },
  onStart({ patient }, actions, flows) {
    this.collection = new Backbone.Collection([...actions.models, ...flows.models]);
    this.showChildView('content', new ListView({ collection: this.collection }));
  },
});
