import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { NIL as NIL_UUID } from 'uuid';

import App from 'js/base/app';

import { ACTION_INCLUDE } from 'js/entities-service/actions';
import { FLOW_INCLUDE } from 'js/entities-service/flows';

import AddWorkflowApp from './add-workflow_app';

import { LayoutView, ListView, WorkflowLoadingView } from './workflow_views';

export default App.extend({
  childApps: {
    addWorkflow: AddWorkflowApp,
  },

  onBeforeStart({ patient, status }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const stateGroup = currentWorkspace.getStates().groupByDone()[status];

    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.patient = patient;
    this.status = status;
    this.states = stateGroup.getFilterIds();

    this.showView(new LayoutView({
      model: patient,
      status,
    }));

    if (status === 'notDone' && !this.currentUser.can('work:own')) {
      this.getRegion('addWorkflow').empty();
    }

    this.showChildView('content', new WorkflowLoadingView());
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

    this.trigger('context:change', {
      page: 'workflow',
      status: this.status,
    });

    this.showChildView('content', new ListView({
      collection: this.collection,
      status: this.status,
    }));

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
    if (this.status === 'done' || !this.currentUser.can('work:own')) return;

    const addWorkflow = this.startChildApp('addWorkflow', {
      region: this.getRegion('addWorkflow'),
      patient: this.patient,
    });

    this.listenTo(addWorkflow, {
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
      Radio.trigger('event-router', 'patient:flow', this.patient.id, flow.id);
    });
  },
});
