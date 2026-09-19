import Backbone from 'backbone';
import { Radio } from 'marionette';
import { NIL as NIL_UUID } from 'uuid';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { ACTION_INCLUDE } from 'js/entities-service/actions';
import { FLOW_INCLUDE } from 'js/entities-service/flows';

import AddWorkflowApp from './add-workflow_app';

import { LayoutView, ListView, WorkflowLoadingView } from './workflow_views';

export default App.extend({
  initialize() {
    const addWorkflow = this.addChildApp('addWorkflow', new AddWorkflowApp());

    this.listenTo(addWorkflow, {
      'add:programAction': this.onAddProgramAction,
      'add:programFlow': this.onAddProgramFlow,
    });
  },
  onBeforeStart(app, { patient, status }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const stateGroup = currentWorkspace.getStates().groupByDone()[status];

    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.patient = patient;
    this.status = status;
    this.states = stateGroup.getFilterIds();

    const view = this.setView(new LayoutView({
      model: patient,
      status,
    })).render();

    if (status === 'notDone' && !this.currentUser.can('work:own')) {
      view.getRegion('addWorkflow').empty();
    }

    view.showChildView('content', new WorkflowLoadingView());

    // Every start replaces the workflow content with its loading state.
    this.showView();
  },

  prepareStart({ patient }, { signal }) {
    const filter = { states: this.states };

    return Promise.all([
      Radio.request('entities', 'fetch:actions:collection:byPatient', { patientId: patient.id, filter }, { signal }),
      Radio.request('entities', 'fetch:flows:collection:byPatient', { patientId: patient.id, filter }, { signal }),
    ]);
  },

  onStart(app, options, [actions, flows]) {
    this.collection = new Backbone.Collection([...actions.models, ...flows.models]);

    this.subscribe();

    this.trigger('context:change', {
      page: 'workflow',
      status: this.status,
    });

    this.getView().showChildView('content', new ListView({
      collection: this.collection,
      status: this.status,
    }));

    this.startAddWorkflow();
    this.showView();
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

    const addWorkflow = this.getChildApp('addWorkflow');

    addWorkflow.start({
      patient: this.patient,
      region: this.getView().getRegion('addWorkflow'),
    }).catch(addError);
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
