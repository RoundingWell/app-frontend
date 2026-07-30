import { get } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';
import handleErrors from 'js/utils/handle-errors';

import intl from 'js/i18n';

import { LayoutView, MenuView, HeadingView } from 'js/apps/patients/patient/action/action_views';
import { ActionView, ReadOnlyActionView } from 'js/apps/patients/patient/action/action-details_views';
import { DialerView } from 'js/apps/patients/patient/action/action-dialer_views';
import { FormLayoutView } from 'js/apps/patients/patient/action/action-forms_views';
import ActivityApp from 'js/apps/patients/patient/action/action-activity_app';
import AttachmentsApp from 'js/apps/patients/patient/action/action-attachments_app';

export default App.extend({
  childApps: {
    activity: ActivityApp,
    attachments: AttachmentsApp,
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
    this.showDialer();
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
    this.getRegion().startPreloader();
  },
  beforeStart({ actionId, flowId }) {
    return [
      Radio.request('entities', 'fetch:actions:model', actionId),
      flowId && Radio.request('entities', 'fetch:flows:model', flowId),
    ];
  },
  /* istanbul ignore next: page-level action error handling */
  onFail(options, error) {
    if (get(error, ['response', 'status']) === 410) {
      Radio.request('alert', 'show:error', intl.patients.patient.action.actionApp.notFound);
      this.stop();
      return;
    }

    handleErrors(error);
  },
  onStart(options, action, flow) {
    this.patient = options.patient;
    this.flow = flow || null;
    this.action = action;

    this.setAccess();
    this.currentFlow = this.flow || this.action.getFlow();
    if (this.currentFlow) this.listenTo(this.currentFlow, 'change:_state', this.setAccess);

    this.listenTo(action, {
      'change:_owner': this.onChangeOwner,
      'destroy': this.onDestroy,
    });

    this.showView(new LayoutView());

    this.showChildView('heading', new HeadingView({ model: this.action }));
    this.showContent();
    this.showMenu();
    this.startActivity();
    this.startAttachments();

    this.triggerMethod('context:change', {
      page: 'action',
      actionId: this.action.id,
      actionName: this.action.get('name'),
      flowId: this.flow && this.flow.id,
      flowName: this.getFlowName(),
    });

    this.subscribe();
  },
  onBeforeStop() {
    if (!this.action) return;

    this.unsubscribe();
  },
  onChangeOwner() {
    this.setAccess();
  },
  showContent() {
    this.showAction();
    this.showForm();
    this.showDialer();
  },
  showAction() {
    if (!this.getState('canEdit')) {
      this.showContentView('action', new ReadOnlyActionView({ model: this.action }));
      return;
    }

    const actionView = new ActionView({ model: this.action });

    this.listenTo(actionView, {
      'save': this.onSave,
    });

    this.showContentView('action', actionView);
  },
  onSave({ model }) {
    this.action.save({ details: model.get('details') });
  },
  showMenu() {
    if (!this.getState('canDelete')) {
      this.getRegion('menu').empty();
      return;
    }

    const menuView = new MenuView({ model: this.action });

    this.listenTo(menuView, 'delete', this.onDelete);

    this.showChildView('menu', menuView);
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
    if (!this.action.getForm() && !this.action.hasSharing()) return;

    const formView = this.showContentView('form', new FormLayoutView({
      model: this.action,
      isShowingForm: this.getOption('isShowingForm'),
    }));

    this.listenTo(formView, {
      'click:form': this.onClickForm,
    });
  },
  onClickForm(form) {
    Radio.trigger('event-router', 'patient:form:action', this.patient.id, form.id, this.action.id);
  },
  showDialer() {
    if (!Radio.request('settings', 'get', 'dialer')) return;

    this.showContentView('dialer', new DialerView({
      model: this.action,
      canEdit: this.getState('canEdit'),
    }));
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
