import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { NIL as NIL_UUID } from 'uuid';

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

    const filters = {
      states: this.states.groupByDone().done.getFilterIds(),
      patient: this.patient.id,
    };

    channel.request('subscribe', this.collection.models, {
      filters: { actions: { ...filters, flow: NIL_UUID }, flows: filters },
    });

    this.listenTo(channel, 'message', (data, model) => {
      if (this.collection.get(model) || model.isFetching()) return;

      model.fetch().then(() => {
        this.collection.add(model);
        Radio.request('ws', 'add', model);
      });
    });
  },
});
