import Backbone from 'backbone';
import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

import { addError } from 'js/datadog';
import handleErrors from 'js/utils/handle-errors';
import localStore from 'js/utils/local-store';
import sessionStore from 'js/utils/session-store';

import App from 'js/base/app';

import WorkflowPageApp from 'js/apps/patients/patient/workflow/workflow_app';
import InteractionsPageApp from 'js/apps/patients/patient/interactions/interactions_app';
import FlowPageApp from 'js/apps/patients/patient/flow/flow_app';
import ActionApp from 'js/apps/patients/patient/action/action_app';
import FormApp from 'js/apps/patients/patient/form/form_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import { LoadingView } from 'js/regions/preload_region';

import { LayoutView } from 'js/apps/patients/patient/patient_views';

const ROUTE_ACTIONS = {
  'patient:workflow': 'showWorkflow',
  'patient:workflow:closed': 'showClosedWorkflow',
  'patient:interactions': 'showInteraction',
  'patient:interaction': 'showInteraction',
  'patient:action': 'showPatientAction',
  'patient:flow': 'showFlow',
  'patient:flow:focus': 'showFlowFocus',
  'patient:flow:action': 'showFlowAction',
  'patient:form': 'showPatientForm',
};

export default App.extend({
  childApps: {
    workflow: WorkflowPageApp,
    interactions: InteractionsPageApp,
    flow: FlowPageApp,
    action: ActionApp,
    form: FormApp,
    patientSidebar: PatientSidebarApp,
  },

  viewEvents: {
    'change:sidebar-layout': 'onChangeSidebarLayout',
    'click:sidebarButton': 'togglePatientSidebar',
    'close:sidebar-drawer': 'closePatientSidebarDrawer',
  },

  initialize() {
    this.content = new RouteOutlet({ owner: this, onCleanupError: addError });
  },

  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },

  onStop() {
    this.isInteractionsSelected = false;
    if (this.layoutState) this.stopListening(this.layoutState);
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

    this.setView(layout);
    layout.render();

    this.renderFormExpandedState();
    this.showPatientSidebar();
    this.showView();
  },

  // Activates the detail page of a match. The returned promise settles when the
  // page is ready. The shell above is prepared once per patient.
  showRoute(match) {
    return this[ROUTE_ACTIONS[match.name]](match);
  },

  showWorkflow(match) {
    return this.startContent('workflow', match, { status: 'notDone' });
  },

  showClosedWorkflow(match) {
    return this.startContent('workflow', match, { status: 'done' });
  },

  showInteraction(match) {
    const { interactionId } = match.params;

    if (this.isInteractionsSelected) {
      return this.getChildApp('interactions').navigateToInteraction(interactionId);
    }

    return this.startContent('interactions', match, { interactionId });
  },

  showPatientAction(match) {
    const { actionId } = match.params;

    return this.startContent('action', match, { actionId, entryTarget: match.info?.args?.[0] });
  },

  showFlow(match) {
    return this.startContent('flow', match, { flowId: match.params.flowId });
  },

  showFlowFocus(match) {
    const { flowId, actionId } = match.params;

    return this.startContent('flow', match, { flowId, focusActionId: actionId });
  },

  showFlowAction(match) {
    const { flowId, actionId } = match.params;

    return this.startContent('action', match, { flowId, actionId, entryTarget: match.info?.args?.[0] });
  },

  showPatientForm(match) {
    return this.startContent('form', match, { formId: match.params.formId });
  },

  startContent(appName, match, options) {
    const pageApp = this.getChildApp(appName);

    this.stopListening(undefined, 'context:change', this.updateContextTrail);

    this.setFormExpanded(false);
    this.setSidebarHidden(this.sidebarPreferenceHidden);
    this.contextTrail.set('context', this.getOptimisticContext(appName, options));

    this.listenTo(pageApp, 'context:change', this.updateContextTrail);

    const pageOptions = {
      ...options,
      layoutState: this.layoutState,
      patient: this.patient,
      patientId: this.patient.id,
    };
    const startOptions = { ...pageOptions, region: this.getView().getRegion('content') };

    if (appName === 'interactions') return this.startInteractions(pageApp, startOptions);

    this.stopInteractions();

    return this.content.show(appName, {
      match,
      restart: true,
      options: startOptions,
    }).catch(error => {
      // Failure handlers receive the same shared context as application startup.
      return this.handleContentStartFailure(pageApp, pageOptions, error);
    });
  },
  // The feed owns its loading/error shell and restarts itself, so the host
  // retains it through initial request supersession and recoverable failures
  // instead of selecting it through the outlet.
  startInteractions(interactionsApp, options) {
    this.content.stop();
    this.isInteractionsSelected = true;

    return interactionsApp.start(options).catch(error => this.handleContentStartFailure(interactionsApp, options, error));
  },
  stopInteractions() {
    this.isInteractionsSelected = false;
    this.getChildApp('interactions').stop();
  },
  handleContentStartFailure(pageApp, options, error) {
    if (!pageApp.handleStartFailure) return handleErrors(error);

    try {
      return pageApp.handleStartFailure(options, error);
    } catch(unhandledError) {
      return handleErrors(unhandledError);
    }
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
    const sidebar = this.getChildApp('patientSidebar');

    sidebar.start({
      patient: this.patient,
      region: this.getView().getRegion('sidebar'),
    }).catch(error => {
      sidebar.stop();
      handleErrors(error);
    });
  },
});
