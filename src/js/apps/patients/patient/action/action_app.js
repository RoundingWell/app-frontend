import { get } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';
import handleErrors from 'js/utils/handle-errors';

import intl from 'js/i18n';

import { ActionLoadingView, LayoutView, MenuView } from 'js/apps/patients/patient/action/action_views';
import { ActionView, ReadOnlyActionView } from 'js/apps/patients/patient/action/action-details_views';
import { FormLayoutView } from 'js/apps/patients/patient/action/action-forms_views';
import ActivityApp from 'js/apps/patients/patient/action/action-activity_app';
import AttachmentsApp from 'js/apps/patients/patient/action/action-attachments_app';
import FormApp from 'js/apps/patients/patient/form/form_app';

export default App.extend({
  childApps: {
    activity: ActivityApp,
    attachments: AttachmentsApp,
    form: FormApp,
  },
  setAccess() {
    const canEdit = !this.action.isFlowDone() && this.action.canEdit();
    const canDelete = this.action.canDelete();

    this.setState({ canEdit, canDelete });
  },
  stateEvents: {
    'change:canEdit': 'onStateChangeCanEdit',
    'change:canDelete': 'onStateChangeCanDelete',
  },
  onStateChangeCanEdit() {
    if (!this.hasLayoutRegion('action')) return;

    this.showAction();
  },
  onStateChangeCanDelete() {
    if (!this.hasLayoutRegion('menu')) return;

    this.showMenu();
  },
  hasLayoutRegion(name) {
    const layout = this.getView();

    return this.isRunning()
      && layout
      && !layout.isDestroyed()
      && layout.getRegion(name);
  },
  onBeforeStart() {
    this.getRegion().show(new ActionLoadingView());
  },
  beforeStart({ actionId, flowId }) {
    const actionRequest = this.fetchRouteResource('action',
      Radio.request('entities', 'fetch:actions:model', actionId),
    );

    if (!flowId) return actionRequest;

    const flowRequest = this.fetchRouteResource('flow',
      Radio.request('entities', 'fetch:flows:model', flowId),
    );

    return [actionRequest, flowRequest];
  },
  fetchRouteResource(resource, request) {
    return request.catch(error => Promise.reject({ resource, error }));
  },
  onFail(options, failure) {
    const error = get(failure, 'error', failure);
    const resource = get(failure, 'resource');

    if (get(error, ['response', 'status']) === 410) {
      const message = resource === 'flow' ?
        intl.patients.patient.flow.flowViews.notFound :
        intl.patients.patient.action.actionApp.notFound;

      Radio.request('alert', 'show:error', message);
      this.navigateAfterGone(options, resource);
      return;
    }

    handleErrors(error);
  },
  navigateAfterGone({ patient, flowId }, resource) {
    if (flowId && resource === 'action') {
      Radio.trigger('event-router', 'patient:flow', patient.id, flowId);
      return;
    }

    Radio.trigger('event-router', 'patient:workflow', patient.id);
  },
  onStart(options, action, flow) {
    this.patient = options.patient;
    this.flow = flow || null;
    this.action = action;
    this.layoutState = options.layoutState;
    if (!this.action.hasForm()) {
      this.layoutState.set({ formExpanded: false, sidebarHidden: false });
    }

    this.setAccess();
    this.currentFlow = this.flow || this.action.getFlow();
    if (this.currentFlow) this.listenTo(this.currentFlow, 'change:_state', this.setAccess);

    this.listenTo(action, {
      'change:_owner': this.onChangeOwner,
      'change:name': this.updateContext,
      'destroy': this.onDestroy,
    });
    this.listenTo(this.layoutState, 'change:formExpanded', this.renderFormExpandedState);

    this.showView(new LayoutView());
    this.renderFormExpandedState();

    this.showContent();
    this.showMenu();
    this.startActivity();
    this.startAttachments();

    this.updateContext();

    this.subscribe();
  },
  updateContext() {
    this.triggerMethod('context:change', {
      page: 'action',
      actionId: this.action.id,
      actionName: this.action.get('name'),
      flowId: this.flow && this.flow.id,
      flowName: this.getFlowName(),
    });
  },
  onBeforeStop() {
    this.unsubscribe();
  },
  onChangeOwner() {
    this.setAccess();
  },
  showContent() {
    this.showAction();
    this.showForm();
  },
  showAction() {
    const hasDialer = !!Radio.request('settings', 'get', 'dialer');

    if (!this.getState('canEdit')) {
      this.showContentView('action', new ReadOnlyActionView({
        model: this.action,
        hasDialer,
      }));
      return;
    }

    const actionView = new ActionView({
      model: this.action,
      hasDialer,
    });

    this.listenTo(actionView, {
      'save': this.onSave,
    });

    this.showContentView('action', actionView);
  },
  onSave({ model }) {
    this.action.save({ details: model.get('details') });
  },
  showMenu() {
    const menuRegion = this.getRegion('menu');

    if (!this.getState('canDelete')) {
      menuRegion.empty();
      return;
    }

    const menuView = new MenuView();
    this.listenTo(menuView, 'delete', this.onDelete);
    this.showContentView('menu', menuView);
  },
  onDelete() {
    this.action.destroy({ wait: true })
      .catch(({ responseData }) => {
        Radio.request('alert', 'show:apiError', responseData);
      });
  },
  onDestroy() {
    if (!this.isRunning()) return;

    this.navigateAfterDelete();
  },
  navigateAfterDelete() {
    if (this.flow) {
      Radio.trigger('event-router', 'patient:flow', this.patient.id, this.flow.id);
      return;
    }

    Radio.trigger('event-router', 'patient:workflow', this.patient.id);
  },
  getFlowName() {
    return this.flow && this.flow.get('name');
  },
  showForm() {
    const hasForm = this.action.hasForm();

    if (!hasForm && !this.action.hasSharing()) return;

    const formView = this.showContentView('form', new FormLayoutView({
      model: this.action,
    }));

    this.listenTo(formView, {
      'click:form': this.onClickForm,
    });

    if (hasForm) this.startEmbeddedForm(formView);
  },
  startEmbeddedForm(formView) {
    const formApp = this.startChildApp('form', {
      region: formView.getRegion('form'),
      patient: this.patient,
      actionId: this.action.id,
      layoutState: this.layoutState,
      viewportView: this.getView(),
    });

    this.listenTo(formApp, {
      'toggle:expanded': this.onToggleFormExpanded,
    });
  },
  matchesRoute({ actionId, flowId }) {
    const currentFlowId = this.flow && this.flow.id;

    return this.action.id === actionId && currentFlowId === (flowId || null);
  },
  onToggleFormExpanded() {
    const isExpanded = !this.layoutState.get('formExpanded');
    const event = this.getActionRouteEvent(isExpanded);
    const args = this.getActionRouteArgs();

    Radio.trigger('event-router', event, ...args);
  },
  getActionRouteEvent(isExpanded) {
    if (this.flow) return isExpanded ? 'patient:flow:action:form' : 'patient:flow:action';

    return isExpanded ? 'patient:action:form' : 'patient:action';
  },
  getActionRouteArgs() {
    if (this.flow) return [this.patient.id, this.flow.id, this.action.id];

    return [this.patient.id, this.action.id];
  },
  renderFormExpandedState() {
    const isExpanded = this.layoutState.get('formExpanded');
    const layout = this.getView();

    layout.$el.toggleClass('patient-action--form-expanded', isExpanded);
  },
  onClickForm() {
    if (this.flow) {
      Radio.trigger('event-router', 'patient:flow:action', this.patient.id, this.flow.id, this.action.id);
      return;
    }

    Radio.trigger('event-router', 'patient:action', this.patient.id, this.action.id);
  },
  getSubscriptionResources() {
    return [
      this.action,
      this.currentFlow,
    ].filter(Boolean);
  },
  subscribe() {
    Radio.request('ws', 'subscribe', this.getSubscriptionResources());
  },
  unsubscribe() {
    Radio.request('ws', 'unsubscribe', this.getSubscriptionResources());
  },
  startActivity() {
    this.startChildApp('activity', {
      region: this.getRegion('activity'),
      action: this.action,
    });
  },
  startAttachments() {
    this.startChildApp('attachments', {
      region: this.getRegion('attachments'),
      action: this.action,
    });
  },
  showContentView(name, view, options) {
    const region = this.getRegion(name);
    region.show(view, options);
    return view;
  },
});
