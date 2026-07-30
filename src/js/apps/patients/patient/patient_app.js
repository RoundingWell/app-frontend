import { get } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import handleErrors from 'js/utils/handle-errors';

import SubRouterApp from 'js/base/subrouterapp';

import WorkflowPageApp from 'js/apps/patients/patient/workflow/workflow_app';
import FlowPageApp from 'js/apps/patients/patient/flow/flow_app';
import ActionApp from 'js/apps/patients/patient/action/action_app';
import FormApp from 'js/apps/patients/patient/form/form_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';

import { LayoutView } from 'js/apps/patients/patient/patient_views';

export default SubRouterApp.extend({
  routeScope: ['patientId'],

  routeActions() {
    return {
      'patient:workflow': this.showWorkflow,
      'patient:workflow:closed': this.showClosedWorkflow,
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
    form: FormApp,
    patientSidebar: PatientSidebarApp,
  },

  currentAppOptions() {
    return {
      region: this.getRegion('content'),
      patient: this.patient,
      patientId: this.patient.id,
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

  showWorkflow() {
    this.startContent('workflow', { status: 'notDone' });
  },

  showClosedWorkflow() {
    this.startContent('workflow', { status: 'done' });
  },

  showPatientAction(patientId, actionId) {
    this.startContent('action', { actionId });
  },

  showFlow(patientId, flowId) {
    this.startContent('flow', { flowId });
  },

  showFlowAction(patientId, flowId, actionId) {
    this.startContent('action', { flowId, actionId });
  },

  showPatientForm(patientId, formId) {
    this.startContent('form', { formId });
  },

  showActionForm(patientId, formId, actionId) {
    this.startContent('form', { formId, actionId });
  },

  startContent(appName, options) {
    this.contextTrail.set('context', this.getOptimisticContext(appName, options));

    const pageApp = this.getChildApp(appName);

    this.stopListening(pageApp, 'context:change');
    this.listenTo(pageApp, 'context:change', this.updateContextTrail);

    this.startCurrent(appName, options);
  },

  getOptimisticContext(page, options) {
    const previous = this.contextTrail.get('context') || {};
    const context = { page };

    if (page === 'workflow') {
      context.status = options.status;
      return context;
    }

    const flowId = this.getOptimisticFlowId(options, previous);

    this.addOptimisticResource(context, previous, 'flow', flowId);
    this.addOptimisticResource(context, previous, 'action', options.actionId);
    this.addOptimisticResource(context, previous, 'form', options.formId);

    return context;
  },

  getOptimisticFlowId({ flowId, actionId }, previous) {
    if (flowId) return flowId;
    if (!actionId) return;
    if (actionId !== previous.actionId) return;

    return previous.flowId;
  },

  addOptimisticResource(context, previous, resource, id) {
    if (!id) return;

    const idKey = `${ resource }Id`;
    const nameKey = `${ resource }Name`;

    context[idKey] = id;
    if (id === previous[idKey] && previous[nameKey]) {
      context[nameKey] = previous[nameKey];
    }
  },

  updateContextTrail(context) {
    this.contextTrail.set('context', context);
  },

  showPatientSidebar() {
    this.startChildApp('patientSidebar', {
      region: this.getRegion('sidebar'),
      patient: this.patient,
    });
  },
});
