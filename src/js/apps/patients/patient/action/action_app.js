import { get } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import intl from 'js/i18n';
import tagRequestFailure from 'js/utils/tag-request-failure';

import App from 'js/base/app';

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
  initialize() {
    this.listenTo(this.getChildApp('form'), 'toggle:expanded', this.onToggleFormExpanded);
  },
  createState() {
    return new Backbone.Model();
  },
  setAccess() {
    const canEdit = !this.action.isFlowDone() && this.action.canEdit();
    const canDelete = this.action.canDelete();

    this.getState().set({ canEdit, canDelete });
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
    this.showView(new ActionLoadingView());
  },
  prepareStart({ actionId, flowId }, { signal }) {
    const actionRequest = tagRequestFailure('action',
      Radio.request('entities', 'fetch:actions:model', actionId, { signal }),
    );

    if (!flowId) return Promise.all([actionRequest, null]);

    const flowRequest = tagRequestFailure('flow',
      Radio.request('entities', 'fetch:flows:model', flowId, { signal }),
    );

    return Promise.all([actionRequest, flowRequest]);
  },
  handleStartFailure(options, failure) {
    const error = get(failure, 'error', failure);
    const resource = get(failure, 'resource');

    if ((resource === 'action' || resource === 'flow') && get(error, ['response', 'status']) === 410) {
      const message = resource === 'flow' ?
        intl.patients.patient.flow.flowViews.notFound :
        intl.patients.patient.action.actionApp.notFound;

      Radio.request('alert', 'show:error', message);
      this.navigateAfterGone(options, resource);
      return;
    }

    throw error;
  },
  navigateAfterGone({ patient, flowId }, resource) {
    if (flowId && resource === 'action') {
      Radio.trigger('event-router', 'patient:flow', patient.id, flowId);
      return;
    }

    Radio.trigger('event-router', 'patient:workflow', patient.id);
  },
  onStart(app, options, [action, flow]) {
    this.patient = options.patient;
    this.flow = flow || null;
    this.action = action;
    this.layoutState = options.layoutState;
    const { entryTarget } = options;
    this.layoutState.set('formExpanded', this.action.hasForm() && !!entryTarget?.formExpanded);

    this.setAccess();
    this.currentFlow = this.flow || this.action.getFlow();
    if (this.currentFlow) {
      this.listenTo(this.currentFlow, {
        'change:_state': this.setAccess,
        'change:name': this.updateContext,
      });
    }

    this.listenTo(action, {
      'change:_owner': this.onChangeOwner,
      'change:name': this.updateContext,
      'destroy': this.onActionDestroy,
    });
    this.listenTo(this.layoutState, 'change:formExpanded', this.renderFormExpandedState);

    this.setView(new LayoutView()).render();
    this.renderFormExpandedState();

    this.showContent();
    this.showMenu();
    this.activityApp = this.startActivity(entryTarget?.section);
    this.attachmentsApp = this.startAttachments(entryTarget?.section);

    this.updateContext();

    this.subscribe();
    this.showView();
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
  onStop() {
    this.unsubscribe();
    if (this.currentFlow) this.stopListening(this.currentFlow);
    if (this.action) this.stopListening(this.action);
    if (this.layoutState) this.stopListening(this.layoutState);
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

    if (!this.getState().get('canEdit')) {
      const actionView = new ReadOnlyActionView({
        model: this.action,
        hasDialer,
      });

      this.listenToActionSectionLinks(actionView);
      this.showContentView('action', actionView);
      return;
    }

    const actionView = new ActionView({
      model: this.action,
      hasDialer,
    });

    this.listenTo(actionView, {
      'save': this.onSave,
    });
    this.listenToActionSectionLinks(actionView);

    this.showContentView('action', actionView);
  },
  onSave({ model }) {
    this.action.save({ details: model.get('details') });
  },
  listenToActionSectionLinks(actionView) {
    this.listenTo(actionView, {
      'click:attachments': () => this.attachmentsApp.focus(),
      'click:comments': () => this.activityApp.focus(),
    });
  },
  showMenu() {
    const menuRegion = this.getView().getRegion('menu');

    if (!this.getState().get('canDelete')) {
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
  onActionDestroy() {
    // Stop removes the model listener; this only protects an already-dispatched callback.
    /* istanbul ignore if */
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
    if (!this.action.hasForm()) return;

    const formView = this.showContentView('form', new FormLayoutView({
      model: this.action,
    }));

    this.startEmbeddedForm(formView);
  },
  startEmbeddedForm(formView) {
    const formApp = this.getChildApp('form');
    formApp.start({
      region: formView.getRegion('form'),
      patient: this.patient,
      actionId: this.action.id,
      layoutState: this.layoutState,
      viewportView: this.getView(),
    }).catch(error => {
      try {
        formApp.handleStartFailure({ actionId: this.action.id }, error);
      } catch(unhandledError) {
        addError(unhandledError);
      }
    });
  },
  onToggleFormExpanded() {
    this.layoutState.set('formExpanded', !this.layoutState.get('formExpanded'));
  },
  renderFormExpandedState() {
    const isExpanded = this.layoutState.get('formExpanded');
    const layout = this.getView();

    layout.setFormExpanded(isExpanded);
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
  startActivity(initialSection) {
    const activityApp = this.getChildApp('activity');

    activityApp.start({
      region: this.getView().getRegion('activity'),
      action: this.action,
      focusOnLoad: initialSection === 'comments',
    }).catch(addError);

    return activityApp;
  },
  startAttachments(initialSection) {
    const attachmentsApp = this.getChildApp('attachments');

    attachmentsApp.start({
      region: this.getView().getRegion('attachments'),
      action: this.action,
      focusOnLoad: initialSection === 'attachments',
    }).catch(addError);

    return attachmentsApp;
  },
  showContentView(name, view, options) {
    const region = this.getView().getRegion(name);
    region.show(view, options);
    return view;
  },
});
