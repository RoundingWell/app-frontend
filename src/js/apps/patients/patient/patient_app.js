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

const EXPANDED_FORM_ROUTES = new Set([
  'patient:action:form',
  'patient:flow:action:form',
]);

export default SubRouterApp.extend({
  routeScope: ['patientId'],

  routeActions() {
    return {
      'patient:workflow': this.showWorkflow,
      'patient:workflow:closed': this.showClosedWorkflow,
      'patient:action': this.showPatientAction,
      'patient:action:form': this.showPatientActionForm,
      'patient:flow': this.showFlow,
      'patient:flow:action': this.showFlowAction,
      'patient:flow:action:form': this.showFlowActionForm,
      'patient:form': this.showPatientForm,
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
      layoutState: this.layoutState,
      region: this.getRegion('content'),
      patient: this.patient,
      patientId: this.patient.id,
    };
  },

  onBeforeStart() {
    this.getRegion().startPreloader({ variant: 'generic' });
  },

  onBeforeStop() {
    Radio.request('nav', 'setMinimized', false);
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
    const formExpanded = EXPANDED_FORM_ROUTES.has(this.getCurrentRoute().event);

    this.layoutState = new Backbone.Model({
      formExpanded,
      sidebarHidden: formExpanded,
    });
    this.listenTo(this.layoutState, 'change:formExpanded', this.renderFormExpandedState);
    this.sidebarHiddenBeforeDrawer = formExpanded;

    const layout = new LayoutView({
      model: patient,
      contextTrail: this.contextTrail,
      layoutState: this.layoutState,
    });

    this.listenTo(layout, {
      'change:sidebar-drawer': this.onChangeSidebarDrawer,
      'click:sidebarButton': this.togglePatientSidebar,
      'close:sidebar-drawer': this.closePatientSidebarDrawer,
    });
    this.setView(layout);

    this.showView();
    this.renderFormExpandedState();
    this.showPatientSidebar();
    this.startCurrentRoute();
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

  showPatientActionForm(patientId, actionId) {
    this.startContent('action', { actionId, formExpanded: true });
  },

  showFlow(patientId, flowId) {
    this.startContent('flow', { flowId });
  },

  showFlowAction(patientId, flowId, actionId) {
    this.startContent('action', { flowId, actionId });
  },

  showFlowActionForm(patientId, flowId, actionId) {
    this.startContent('action', { flowId, actionId, formExpanded: true });
  },

  showPatientForm(patientId, formId) {
    this.startContent('form', { formId });
  },

  startContent(appName, options) {
    const formExpanded = !!options.formExpanded;
    const previousPageApp = this.getCurrent();

    if (previousPageApp) {
      this.stopListening(previousPageApp, 'context:change');
    }

    this.setSidebarHidden(formExpanded);
    this.setFormExpanded(formExpanded);
    this.contextTrail.set('context', this.getOptimisticContext(appName, options));

    const pageApp = this.getChildApp(appName);

    this.listenTo(pageApp, 'context:change', this.updateContextTrail);

    if (this.updateCurrentContent(appName, options)) return;

    this.startCurrent(appName, options);
  },
  updateCurrentContent(appName, options) {
    const current = this.getCurrent();
    const actionApp = this.getChildApp('action');

    if (appName !== 'action' || current !== actionApp || !current.isRunning()) return false;
    if (!current.matchesRoute(options)) return false;

    return true;
  },
  setSidebarHidden(isHidden) {
    const layout = this.getView();

    if (!this._isTogglingPatientSidebar) this.sidebarHiddenBeforeDrawer = isHidden;

    const shouldHide = layout.isSidebarDrawer() && !this._isTogglingPatientSidebar ? true : isHidden;

    this.layoutState.set('sidebarHidden', shouldHide);
  },
  setFormExpanded(isExpanded) {
    this.layoutState.set('formExpanded', isExpanded);
  },
  renderFormExpandedState() {
    Radio.request('nav', 'setMinimized', this.layoutState.get('formExpanded'));
  },
  togglePatientSidebar() {
    const isHidden = !this.getView().isSidebarHidden();
    this._isTogglingPatientSidebar = true;
    this.setCurrentPatientSidebarHidden(isHidden);
    this._isTogglingPatientSidebar = false;
  },
  setCurrentPatientSidebarHidden(isHidden) {
    this.setSidebarHidden(isHidden);
  },
  onChangeSidebarDrawer(isSidebarDrawer) {
    if (isSidebarDrawer) {
      this.layoutState.set('sidebarHidden', true);
      return;
    }

    this.setCurrentPatientSidebarHidden(this.sidebarHiddenBeforeDrawer);
  },
  closePatientSidebarDrawer() {
    this._isTogglingPatientSidebar = true;
    this.setCurrentPatientSidebarHidden(true);
    this._isTogglingPatientSidebar = false;
    this.getView().focusSidebarToggle();
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
