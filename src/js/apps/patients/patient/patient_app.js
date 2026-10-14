import { mapObject } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import handleErrors from 'js/utils/handle-errors';
import localStore from 'js/utils/local-store';
import sessionStore from 'js/utils/session-store';
import { addError } from 'js/datadog';

import App from 'js/base/app';
import { createChildSelection } from 'js/base/routing/child-selection';
import { createRouteDelivery } from 'js/base/routing/route-delivery';
import { createRouteActions } from 'js/base/routing/route-actions';

import WorkflowPageApp from 'js/apps/patients/patient/workflow/workflow_app';
import FlowPageApp from 'js/apps/patients/patient/flow/flow_app';
import ActionApp from 'js/apps/patients/patient/action/action_app';
import FormApp from 'js/apps/patients/patient/form/form_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import { LoadingView } from 'js/regions/preload_region';

import { LayoutView } from 'js/apps/patients/patient/patient_views';

export default App.extend({
  constructor: function() {
    this.selection = createChildSelection({
      getChild: name => this.getChildApp(name),
      onCleanupError: (error, app) => this.triggerMethod('child:cleanup:error', error, app),
    });
    this.dispatchRoute = createRouteActions({
      getActions: () => mapObject(this.routeActions(), action => action.bind(this)),
      before: route => this.triggerMethod('before:startRoute', route),
      after: route => this.triggerMethod('startRoute', route),
      onError: (error, route) => this.triggerMethod('route:error', error, route),
      isCurrent: route => this.getCurrentRoute() === route,
    });
    this.routeDelivery = createRouteDelivery({
      start: options => this.start(options),
      read: () => this.getCurrentRoute(),
      write: route => this.setCurrentRoute(route),
      dispatch: route => this.dispatchRoute(route),
    });
    this.on('start', () => this.routeDelivery.activated());
    this.on('before:stop', () => {
      this.routeDelivery.invalidate();
      this.selection.invalidate();
    });
    this.on('stop', () => this.selection.clear());
    this.on('before:start', () => this.selection.invalidate());
    App.apply(this, arguments);
  },
  // These three overrides also cover stopped owners, which emit no stop event.
  stop() {
    this.routeDelivery.invalidate();
    this.selection.invalidate();
    const stopped = App.prototype.stop.apply(this, arguments);
    if (stopped) this.selection.clear();
    return stopped;
  },
  restart() {
    this.selection.invalidate();
    return App.prototype.restart.apply(this, arguments);
  },
  destroy() {
    this.routeDelivery.invalidate();
    this.selection.invalidate();
    const destroyed = App.prototype.destroy.apply(this, arguments);
    if (destroyed) this.selection.clear();
    return destroyed;
  },
  onRouteError(error) {
    window.reportError(error);
  },
  onChildCleanupError(error) {
    addError(error);
  },
  createState() {
    return new Backbone.Model({ currentRoute: null });
  },
  getRouteScope({ patientId } = {}) {
    return { patientId };
  },
  setCurrentRoute(route) {
    this.selection.invalidate();
    this.getState().set('currentRoute', route);
  },
  getCurrentRoute() {
    return this.getState().get('currentRoute');
  },
  async startRoute(route, options) {
    const started = await this.routeDelivery.accept(route, options);
    if (started) return this;
  },
  startCurrentRoute() {
    return this.dispatchRoute(this.getCurrentRoute());
  },
  mixinOptions(options) {
    return { ...this.currentAppOptions(), ...options };
  },
  startCurrent(name, options) {
    return this.selection.select(name, { start: app => app.start(this.mixinOptions(options)) });
  },
  childApps: {
    workflow: WorkflowPageApp,
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

  routeActions() {
    return {
      'patient:workflow': this.showWorkflow,
      'patient:workflow:closed': this.showClosedWorkflow,
      'patient:action': this.showPatientAction,
      'patient:flow': this.showFlow,
      'patient:flow:focus': this.showFlowFocus,
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

  showFlowFocus(patientId, flowId, focusActionId) {
    return this.startContent('flow', { flowId, focusActionId });
  },

  showFlowAction(patientId, flowId, actionId, entryTarget) {
    return this.startContent('action', { flowId, actionId, entryTarget });
  },

  showPatientForm(patientId, formId) {
    return this.startContent('form', { formId });
  },

  startContent(appName, options) {
    const pageApp = this.getChildApp(appName);

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
