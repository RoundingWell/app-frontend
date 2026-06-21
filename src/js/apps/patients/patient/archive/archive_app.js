import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { NIL as NIL_UUID } from 'uuid';

import App from 'js/base/app';

import { ACTION_INCLUDE } from 'js/entities-service/actions';
import { FLOW_INCLUDE } from 'js/entities-service/flows';

import { LayoutView, ListView } from 'js/apps/patients/patient/archive/archive_views';

export default App.extend({
  onBeforeStart({ patient }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const { done } = currentWorkspace.getStates().groupByDone();
    this.states = done.getFilterIds();

    this.patient = patient;

    this.showView(new LayoutView({ model: patient }));
    this.getRegion('content').startPreloader();
  },
  beforeStart({ patient }) {
    const filter = { states: this.states };

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
    const filters = {
      states: this.states,
      patient: this.patient.id,
    };

    Radio.request('ws', 'subscribe', this.collection.models, {
      filters: { actions: { ...filters, flow: NIL_UUID }, flows: filters },
    });
    Radio.request('ws', 'manage:add', this, this.collection, 'flows', { include: FLOW_INCLUDE });
    Radio.request('ws', 'manage:add', this, this.collection, 'patient-actions', { include: ACTION_INCLUDE });
  },
});
