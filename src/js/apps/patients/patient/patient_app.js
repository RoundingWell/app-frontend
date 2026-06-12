import { get, partial } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import handleErrors from 'js/utils/handle-errors';

import SubRouterApp from 'js/base/subrouterapp';

// These existing apps stand in for page-oriented replacements during the
// migration. The PatientApp contract below is the intended workspace shape.
import WorkflowPageApp from 'js/apps/patients/patient/dashboard/dashboard_app';
import FlowPageApp from 'js/apps/patients/patient/flow/flow_app';
import ActionApp from 'js/apps/patients/patient/action/action_app';
import FormPageApp from 'js/apps/forms/form/form-patient_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';

import { LayoutView } from 'js/views/patients/patient/patient_views';

export default SubRouterApp.extend({
  routeScope: ['patientId'],

  routeActions() {
    return {
      'patient:workflow': partial(this.showWorkflow, 'active'),
      'patient:workflow:closed': partial(this.showWorkflow, 'closed'),
      'patient:action': this.showPatientAction,
      'patient:flow': this.showFlow,
      'patient:flow:action': this.showFlowAction,
      'patient:form': this.showPatientForm,
      'patient:form:action': this.showActionForm,
    };
  },

  childApps: {
    workflow: WorkflowPageApp,
    flow: FlowPageApp,
    action: ActionApp,
    form: FormPageApp,
    patientSidebar: PatientSidebarApp,
  },

  currentAppOptions() {
    return {
      region: this.getRegion('content'),
      patient: this.patient,
    };
  },

  onBeforeStart() {
    this.getRegion().startPreloader();
  },

  beforeStart() {
    const [patientId] = this.getCurrentRoute().eventArgs;

    return Radio.request('entities', 'fetch:patients:model', patientId);
  },

  /* istanbul ignore next: beforeStart error handling */
  onFail(options, error) {
    if (get(error, ['response', 'status']) === 410) {
      Radio.trigger('event-router', 'notFound');
      this.stop();
      return;
    }

    handleErrors(error);
  },

  onStart(options, patient) {
    this.patient = patient;
    this.contextTrail = new Backbone.Model();

    this.setView(new LayoutView({
      model: patient,
      contextTrail: this.contextTrail,
    }));

    this.showPatientSidebar();
    this.startCurrentRoute();
    this.showView();
  },

  showWorkflow(mode) {
    this.showPage('workflow', { mode }, {
      page: 'workflow',
      mode,
    });
  },

  showPatientAction(patientId, actionId) {
    this.showPage('action', { actionId }, {
      page: 'action',
      actionId,
    });
  },

  showFlow(patientId, flowId) {
    this.showPage('flow', { flowId }, {
      page: 'flow',
      flowId,
    });
  },

  showFlowAction(patientId, flowId, actionId) {
    this.showPage('action', { actionId, flowId }, {
      page: 'action',
      flowId,
      actionId,
    });
  },

  showPatientForm(patientId, formId) {
    this.showPage('form', { formId }, {
      page: 'form',
      formId,
    });
  },

  showActionForm(patientId, formId, actionId) {
    this.showPage('form', { formId, actionId }, {
      page: 'form',
      formId,
      actionId,
    });
  },

  showPage(appName, options, context) {
    this.contextTrail.set(context);

    const pageApp = this.getChildApp(appName);

    this.stopListening(pageApp, 'context:change');
    this.listenTo(pageApp, 'context:change', this.updateContextTrail);

    this.startCurrent(appName, options);
  },

  updateContextTrail(context) {
    this.contextTrail.set(context);
  },

  showPatientSidebar() {
    this.startChildApp('patientSidebar', {
      region: this.getRegion('sidebar'),
      patient: this.patient,
    });
  },
});
