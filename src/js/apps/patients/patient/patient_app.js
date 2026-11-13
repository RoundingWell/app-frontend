import Backbone from 'backbone';
import { Radio } from 'marionette';

import handleErrors from 'js/utils/handle-errors';
import localStore from 'js/utils/local-store';
import sessionStore from 'js/utils/session-store';

import RouteApp from 'js/base/route-app';

import WorkflowPageApp from 'js/apps/patients/patient/workflow/workflow_app';
import InteractionsPageApp from 'js/apps/patients/patient/interactions/interactions_app';
import FlowPageApp from 'js/apps/patients/patient/flow/flow_app';
import ActionApp from 'js/apps/patients/patient/action/action_app';
import FormApp from 'js/apps/patients/patient/form/form_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import { LoadingView } from 'js/regions/preload_region';

import { LayoutView } from 'js/apps/patients/patient/patient_views';

export default RouteApp.extend({
  routes: {
    'workflow': {
      name: 'workflow',
      handler: 'showWorkflow',
    },
    'workflow/closed': {
      name: 'workflow:closed',
      handler: 'showClosedWorkflow',
    },
    'interactions': {
      name: 'interactions',
      handler: 'showInteraction',
    },
    'interactions/:interactionId': {
      name: 'interaction',
      handler: 'showInteraction',
    },
    'action/:actionId': {
      name: 'action',
      handler: 'showPatientAction',
    },
    'flow/:flowId': {
      name: 'flow',
      handler: 'showFlow',
    },
    'flow/:flowId/focus/:actionId': {
      name: 'flow:focus',
      handler: 'showFlowFocus',
    },
    'flow/:flowId/action/:actionId': {
      name: 'flow:action',
      handler: 'showFlowAction',
    },
    'form/:formId': {
      name: 'form',
      handler: 'showPatientForm',
    },
  },

  childApps: {
    content: RouteApp.extend({
      childApps: {
        workflow: WorkflowPageApp,
        flow: FlowPageApp,
        action: ActionApp,
        form: FormApp,
      },
    }),
    interactions: InteractionsPageApp,
    patientSidebar: PatientSidebarApp,
  },

  viewEvents: {
    'change:sidebar-layout': 'onChangeSidebarLayout',
    'click:sidebarButton': 'togglePatientSidebar',
    'close:sidebar-drawer': 'closePatientSidebarDrawer',
  },

  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },

  onStop() {
    if (this.patient) Radio.request('ws', 'subscribe', []);
    this.isInteractionsSelected = false;
    if (this.layoutState) this.stopListening(this.layoutState);
    this.stopListening(undefined, 'context:change', this.updateContextTrail);
    Radio.request('nav', 'setMinimized', false);
  },

  async prepareStart({ patientId }, { signal }) {
    const patient = await Radio.request('entities', 'fetch:patients:model', patientId, {
      signal,
    });
    signal.throwIfAborted();
    await this.getChildApp('content').start();
    signal.throwIfAborted();
    return patient;
  },

  onStart(app, options, patient) {
    this.patient = patient;
    Radio.request('ws', 'add', patient);
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

  showWorkflow(match) {
    return this.startContent('workflow', {
      status: 'notDone',
    }, match.signal);
  },

  showClosedWorkflow(match) {
    return this.startContent('workflow', {
      status: 'done',
    }, match.signal);
  },

  showInteraction(match) {
    const { interactionId } = match.params;

    if (this.isInteractionsSelected) {
      const interactionsApp = this.getChildApp('interactions');
      const navigating = interactionsApp.navigateToInteraction(interactionId);
      const presentation = interactionsApp.initialPresentation();
      return navigating.then(() => presentation);
    }

    return this.startContent('interactions', {
      interactionId,
    }, match.signal);
  },

  showPatientAction(match) {
    const { actionId } = match.params;

    return this.startContent('action', {
      actionId,
      entryTarget: match.info?.entryTarget,
    }, match.signal);
  },

  showFlow(match) {
    return this.startContent('flow', {
      flowId: match.params.flowId,
    }, match.signal);
  },

  showFlowFocus(match) {
    const { flowId, actionId } = match.params;

    return this.startContent('flow', {
      flowId,
      focusActionId: actionId,
    }, match.signal);
  },

  showFlowAction(match) {
    const { flowId, actionId } = match.params;

    return this.startContent('action', {
      flowId,
      actionId,
      entryTarget: match.info?.entryTarget,
    }, match.signal);
  },

  showPatientForm(match) {
    return this.startContent('form', {
      formId: match.params.formId,
    }, match.signal);
  },

  startContent(appName, options, signal) {
    const content = this.getChildApp('content');
    const pageApp = appName === 'interactions' ? this.getChildApp(appName) : content.getChildApp(appName);

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
    const startOptions = {
      ...pageOptions,
      region: this.getView().getRegion('content'),
    };

    // Outgoing pages unsubscribe only their own resources, retaining this
    // patient baseline while the incoming page prepares its subscriptions.
    Radio.request('ws', 'subscribe', this.patient);

    if (appName === 'interactions') return this.startInteractions(pageApp, startOptions);

    this.stopInteractions();

    return content.switchTo(appName, {
      signal,
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
    this.getChildApp('content').clear();
    this.isInteractionsSelected = true;

    const starting = interactionsApp.start(options).catch(error => this.handleContentStartFailure(interactionsApp, options, error));
    const presentation = interactionsApp.initialPresentation();
    return starting.then(() => presentation);
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
