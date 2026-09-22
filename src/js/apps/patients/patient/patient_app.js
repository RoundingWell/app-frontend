import Backbone from 'backbone';
import { Radio } from 'marionette';

import handleErrors from 'js/utils/handle-errors';
import localStore from 'js/utils/local-store';
import sessionStore from 'js/utils/session-store';

import SubRouterApp from 'js/base/subrouterapp';

import WorkflowPageApp from 'js/apps/patients/patient/workflow/workflow_app';
import FlowPageApp from 'js/apps/patients/patient/flow/flow_app';
import ActionApp from 'js/apps/patients/patient/action/action_app';
import FormApp from 'js/apps/patients/patient/form/form_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import { LoadingView } from 'js/regions/preload_region';

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

  currentAppOptions() {
    return {
      layoutState: this.layoutState,
      patient: this.patient,
      patientId: this.patient.id,
    };
  },

  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },

  onStop() {
    this.stopListening(this.layoutState, 'change:formExpanded', this.onChangeFormExpanded);
    this.stopListening(undefined, 'context:change', this.updateContextTrail);
    Radio.request('nav', 'setMinimized', false);
  },

  prepareStart({ patientId }, { signal }) {
    return Radio.request('entities', 'fetch:patients:model', patientId, { signal });
  },

  onStart(app, options, patient) {
    this.patient = patient;
    this.contextTrail = new Backbone.Model();
    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.sidebarPreferenceHidden = !!localStore.get(this.getSidebarPreferenceKey());
    this.expandedSidebarPreferenceHidden = this.getExpandedSidebarPreferenceHidden();
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
    layout.render();

    this.renderFormExpandedState();
    this.showPatientSidebar();
    this.startCurrentRoute();
    this.showView();
  },

  showWorkflow() {
    return this.startContent('workflow', { status: 'notDone' });
  },

  showClosedWorkflow() {
    return this.startContent('workflow', { status: 'done' });
  },

  showPatientAction(patientId, actionId, entryTarget) {
    return this.startContent('action', { actionId, entryTarget });
  },

  showFlow(patientId, flowId) {
    return this.startContent('flow', { flowId });
  },

  showFlowAction(patientId, flowId, actionId, entryTarget) {
    return this.startContent('action', { flowId, actionId, entryTarget });
  },

  showPatientForm(patientId, formId) {
    return this.startContent('form', { formId });
  },

  startContent(appName, options) {
    const pageApp = this.getContentApp(appName);

    this.stopListening(undefined, 'context:change', this.updateContextTrail);

    this.setFormExpanded(false);
    this.setSidebarHidden(this.sidebarPreferenceHidden);
    this.contextTrail.set('context', this.getOptimisticContext(appName, options));

    this.listenTo(pageApp, 'context:change', this.updateContextTrail);

    return this.startCurrent(appName, {
      ...options,
      region: this.getView().getRegion('content'),
    }).catch(error => {
      // Failure handlers receive the same shared context as application startup.
      return this.handleContentStartFailure(pageApp, this.mixinOptions(options), error);
    });
  },
  handleContentStartFailure(pageApp, options, error) {
    if (!pageApp.handleStartFailure) return handleErrors(error);

    try {
      return pageApp.handleStartFailure(options, error);
    } catch(unhandledError) {
      return handleErrors(unhandledError);
    }
  },
  getContentApp(appName) {
    const currentApp = this.getChildApp(appName);
    if (currentApp) return currentApp;

    const ContentApp = {
      workflow: WorkflowPageApp,
      flow: FlowPageApp,
      action: ActionApp,
      form: FormApp,
    }[appName];

    return this.addChildApp(appName, new ContentApp());
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
    this.setSidebarHidden(this.getCurrentSidebarPreferenceHidden());
    this.renderFormExpandedState();
  },
  getCurrentSidebarPreferenceHidden() {
    return this.layoutState.get('formExpanded') ?
      this.expandedSidebarPreferenceHidden :
      this.sidebarPreferenceHidden;
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
  getExpandedSidebarPreferenceKey() {
    return `isExpandedPatientSidebarHidden_${ this.currentUser.id }`;
  },
  getExpandedSidebarPreferenceHidden() {
    const stored = sessionStore.get(this.getExpandedSidebarPreferenceKey());

    return stored === undefined ? true : !!stored;
  },
  setSidebarPreferenceHidden(isHidden) {
    if (this.layoutState.get('formExpanded')) {
      this.expandedSidebarPreferenceHidden = isHidden;
      sessionStore.set(this.getExpandedSidebarPreferenceKey(), isHidden);
      return;
    }

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

    this.setCurrentPatientSidebarHidden(this.getCurrentSidebarPreferenceHidden());
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
    const sidebar = this.getChildApp('patientSidebar')
      || this.addChildApp('patientSidebar', new PatientSidebarApp());

    sidebar.start({
      patient: this.patient,
      region: this.getView().getRegion('sidebar'),
    }).catch(async error => {
      await sidebar.stop();
      handleErrors(error);
    });
  },
});
