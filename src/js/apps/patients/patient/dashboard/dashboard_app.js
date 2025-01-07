import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import AddWorkflowApp from './add-workflow_app';

import { LayoutView, ListView } from 'js/views/patients/patient/dashboard/dashboard_views';

export default App.extend({
  childApps: {
    addWorkflow: AddWorkflowApp,
  },

  onBeforeStart({ patient }) {
    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.patient = patient;
    this.showView(new LayoutView({ model: patient }));
    if (!this.currentUser.can('work:own')) {
      this.getRegion('addWorkflow').empty();
    }
    this.getRegion('content').startPreloader();
  },

  beforeStart({ patient }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();
    const filter = { states: states.groupByDone().notDone.getFilterIds() };

    return [
      Radio.request('entities', 'fetch:actions:collection:byPatient', { patientId: patient.id, filter }),
      Radio.request('entities', 'fetch:flows:collection:byPatient', { patientId: patient.id, filter }),
    ];
  },

  onStart(options, actions, flows) {
    this.collection = new Backbone.Collection([...actions.models, ...flows.models]);

    this.showChildView('content', new ListView({ collection: this.collection }));

    this.startAddWorkflow();
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
    const action = programAction.getAction({ patientId: this.patient.id });
    action.saveAll().then(() => {
      this.collection.unshift(action);

      Radio.trigger('event-router', 'patient:action', this.patient.id, action.id);
    });
  },

  onAddProgramFlow(programFlow) {
    const flow = programFlow.getFlow(this.patient.id);

    flow.saveAll().then(() => {
      Radio.trigger('event-router', 'flow', flow.id);
    });

    return;
  },
});
