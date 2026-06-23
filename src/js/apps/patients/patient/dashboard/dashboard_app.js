import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { NIL as NIL_UUID } from 'uuid';

import App from 'js/base/app';

import { ACTION_INCLUDE } from 'js/entities-service/actions';
import { FLOW_INCLUDE } from 'js/entities-service/flows';

import AddWorkflowApp from './add-workflow_app';

import { LayoutView, ListView } from 'js/apps/patients/patient/dashboard/dashboard_views';

export default App.extend({
  childApps: {
    addWorkflow: AddWorkflowApp,
  },

  onBeforeStart({ patient }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const { notDone } = currentWorkspace.getStates().groupByDone();
    this.states = notDone.getFilterIds();

    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.patient = patient;

    this.showView(new LayoutView({ model: patient }));

    if (!this.currentUser.can('work:own')) {
      this.getRegion('addWorkflow').empty();
    }

    this.getRegion('content').startPreloader();
  },

  beforeStart({ patient }) {
    const filter = { states: this.states };

    return [
      Radio.request('entities', 'fetch:actions:collection:byPatient', { patientId: patient.id, filter }),
      Radio.request('entities', 'fetch:flows:collection:byPatient', { patientId: patient.id, filter }),
    ];
  },

  onStart(options, actions, flows) {
    this.collection = new Backbone.Collection([...actions.models, ...flows.models]);

    this.subscribe();

    this.showChildView('content', new ListView({ collection: this.collection }));

    this.startAddWorkflow();
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
  startAddWorkflow() {
    if (!this.currentUser.can('work:own')) return;

    const addworkflow = this.startChildApp('addWorkflow', {
      region: this.getRegion('addWorkflow'),
      patient: this.patient,
    });

    this.listenTo(addworkflow, {
      'add:programAction': this.onAddProgramAction,
      'add:programFlow': this.onAddProgramFlow,
    });
  },

  onAddProgramAction(programAction) {
    const action = programAction.createAction({ patient: this.patient });
    action.saveAll().then(() => {
      this.collection.unshift(action);
      Radio.request('ws', 'add', action);

      Radio.trigger('event-router', 'patient:action', this.patient.id, action.id);
    });
  },

  onAddProgramFlow(programFlow) {
    const flow = programFlow.createFlow(this.patient);

    flow.saveAll().then(() => {
      Radio.trigger('event-router', 'flow', flow.id);
    });

    return;
  },
});
