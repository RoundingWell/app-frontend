import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import { LayoutView, ListView } from 'js/views/patients/patient/archive/archive_views';

export default App.extend({
  onBeforeStart({ patient }) {
    this.patient = patient;
    this.showView(new LayoutView({ model: patient }));
    this.getRegion('content').startPreloader();
  },
  beforeStart({ patient }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    this.states = currentWorkspace.getStates();

    const filter = { states: this.states.groupByDone().done.getFilterIds() };

    return [
      Radio.request('entities', 'fetch:actions:collection:byPatient', { patientId: patient.id, filter }),
      Radio.request('entities', 'fetch:flows:collection:byPatient', { patientId: patient.id, filter }),
    ];
  },
  onStart({ patient }, actions, flows) {
    this.collection = new Backbone.Collection([...actions.models, ...flows.models]);

    this.subscribe();

    this.showChildView('content', new ListView({ collection: this.collection }));
  },
  subscribe() {
    const channel = Radio.channel('ws');

    const filter = {
      states: this.states.groupByDone().done.getFilterIds(),
      patient: this.patient.id,
    };

    channel.request('subscribe', this.collection.models, {
      filters: { actions: filter, flows: filter },
    });

    this.listenTo(channel, 'message', (data, model) => {
      if (this.collection.get(model) || model.isFetching()) return;

      model.fetch().then(() => {
        if (model.type === 'patient-actions' && model.getFlow()) return;

        this.collection.add(model);
        Radio.request('ws', 'add', model);
      });
    });
  },
});
