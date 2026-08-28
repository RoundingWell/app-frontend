import { get } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import handleErrors from 'js/utils/handle-errors';
import localStore from 'js/utils/local-store';

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
    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.sidebarPreferenceHidden = !!localStore.get(this.getSidebarPreferenceKey());
    this.layoutState = new Backbone.Model({
      formExpanded: false,
      sidebarHidden: this.sidebarPreferenceHidden,
    });
    this.listenTo(this.layoutState, 'change:formExpanded', this.onChangeFormExpanded);

    const layout = new LayoutView({
      model: patient,
      contextTrail: this.contextTrail,
      layoutState: this.layoutState,
    });

    this.listenTo(layout, {
      'change:sidebar-layout': this.onChangeSidebarLayout,
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

  showPatientAction(patientId, actionId, entryTarget) {
    this.startContent('action', { actionId, entryTarget });
  },

  showFlow(patientId, flowId) {
    this.startContent('flow', { flowId });
  },

  showFlowAction(patientId, flowId, actionId, entryTarget) {
    this.startContent('action', { flowId, actionId, entryTarget });
  },

  showPatientForm(patientId, formId) {
    this.startContent('form', { formId });
  },

  startContent(appName, options) {
    const previousPageApp = this.getCurrent();

    if (previousPageApp) {
      this.stopListening(previousPageApp, 'context:change');
    }

    this.setFormExpanded(false);
    this.setSidebarHidden(this.sidebarPreferenceHidden);
    this.contextTrail.set('context', this.getOptimisticContext(appName, options));

    const pageApp = this.getChildApp(appName);

    this.listenTo(pageApp, 'context:change', this.updateContextTrail);

    this.startCurrent(appName, options);
  },
  setSidebarHidden(isHidden) {
    const layout = this.getView();

    const shouldHide = !layout.isSidebarFixed()
      && (layout.isSidebarDrawer() && !this._isTogglingPatientSidebar ? true : isHidden);

    this.layoutState.set('sidebarHidden', shouldHide);
  },
  setFormExpanded(isExpanded) {
    this.layoutState.set('formExpanded', isExpanded);
  },
  onChangeFormExpanded() {
    const isExpanded = this.layoutState.get('formExpanded');

    this.setSidebarHidden(isExpanded || this.sidebarPreferenceHidden);
    this.renderFormExpandedState();
  },
  renderFormExpandedState() {
    Radio.request('nav', 'setMinimized', this.layoutState.get('formExpanded'));
  },
  togglePatientSidebar() {
    const isHidden = !this.getView().isSidebarHidden();
    this.setSidebarPreferenceHidden(isHidden);
    this._isTogglingPatientSidebar = true;
    this.setCurrentPatientSidebarHidden(isHidden);
    this._isTogglingPatientSidebar = false;
  },
  getSidebarPreferenceKey() {
    return `isPatientSidebarHidden_${ this.currentUser.id }`;
  },
  setSidebarPreferenceHidden(isHidden) {
    this.sidebarPreferenceHidden = isHidden;
    localStore.set(this.getSidebarPreferenceKey(), isHidden);
  },
  setCurrentPatientSidebarHidden(isHidden) {
    this.setSidebarHidden(isHidden);
  },
  onChangeSidebarLayout({ isSidebarDrawer, isSidebarFixed }) {
    if (isSidebarFixed) {
      this.layoutState.set('sidebarHidden', false);
      return;
    }

    if (isSidebarDrawer) {
      this.layoutState.set('sidebarHidden', true);
      return;
    }

    this.setCurrentPatientSidebarHidden(this.layoutState.get('formExpanded') || this.sidebarPreferenceHidden);
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

    this.addOptimisticResource(context, previous, 'flow', options.flowId);
    this.addOptimisticResource(context, previous, 'action', options.actionId);
    this.addOptimisticResource(context, previous, 'form', options.formId);

    return context;
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
