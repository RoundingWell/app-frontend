import { get } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import App from 'js/base/app';
import handleErrors from 'js/utils/handle-errors';

import intl from 'js/i18n';

import { ContentView, MenuView, HeadingView, FooterView } from 'js/apps/patients/patient/action/action_views';
import { ActionView, ReadOnlyActionView } from 'js/apps/patients/patient/action/action-details_views';
import { DialerView } from 'js/apps/patients/patient/action/action-dialer_views';
import { FormLayoutView } from 'js/apps/patients/patient/action/action-forms_views';
import { CommentFormView } from 'js/apps/patients/shared/comments_views';
import { ActivitiesView, TimestampsView } from 'js/apps/patients/patient/action/action-activity_views';
import { AttachmentsView } from 'js/apps/patients/patient/action/action-attachments_views';

const LayoutView = View.extend({
  className: 'patient-action flex-region',
  template: hbs`
    <div class="patient-action__header">
      <div data-heading-region></div>
      <div data-menu-region></div>
    </div>
    <div class="patient-action__content" data-content-region></div>
    <div class="patient-action__footer" data-footer-region></div>
  `,
  regions: {
    heading: '[data-heading-region]',
    menu: '[data-menu-region]',
    content: '[data-content-region]',
    footer: '[data-footer-region]',
  },
});

export default App.extend({
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
    if (!this.hasContentView()) return;

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
  hasContentView() {
    const contentRegion = this.hasLayoutRegion('content');

    return contentRegion && contentRegion.hasView();
  },
  onBeforeStart() {
    this.getRegion().startPreloader();
  },
  beforeStart({ actionId, flowId }) {
    return [
      Radio.request('entities', 'fetch:actions:model', actionId),
      flowId && Radio.request('entities', 'fetch:flows:model', flowId),
      Radio.request('entities', 'fetch:actionEvents:collection', actionId),
      Radio.request('entities', 'fetch:comments:collection:byAction', actionId),
      Radio.request('entities', 'fetch:files:collection:byAction', actionId),
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
  onStart(options, action, flow, activity, comments, attachments) {
    this.patient = options.patient;
    this.flow = flow || null;
    this.action = action;
    this.activityCollection = new Backbone.Collection([...activity.models, ...comments.models]);
    this.comments = comments;
    this.attachments = attachments;

    this.setAccess();
    this.currentFlow = this.flow || this.action.getFlow();
    if (this.currentFlow) this.listenTo(this.currentFlow, 'change:_state', this.setAccess);

    this.listenTo(action, {
      'change:_owner': this.onChangeOwner,
      'destroy': this.onDestroy,
      'ws:add:comment': this.onWsAddComment,
      'ws:add:attachment': this.onWsAddAttachment,
    });

    this.showView(new LayoutView());

    this.showChildView('heading', new HeadingView({ model: this.action }));
    this.showContent();
    this.showChildView('footer', new FooterView());
    this.showMenu();
    this.showActivity();
    this.showNewCommentForm();
    this.showAttachments();

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
    if (this.isRunning()) this.showAttachments();
  },
  onWsAddComment(model) {
    this.activityCollection.add(model);
    this.comments.add(model);

    Radio.request('ws', 'add', model);
  },
  onWsAddAttachment(model) {
    this.attachments.add(model);

    Radio.request('ws', 'add', model);

    if (this.attachments.length === 1) this.showAttachments();
  },
  showContent() {
    const actionView = new ContentView({ model: this.action });

    this.showChildView('content', actionView);
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
  showActivity() {
    const activitiesView = new ActivitiesView({
      collection: this.activityCollection,
      model: this.action,
    });
    const createdEvent = this.activityCollection.find({ event_type: 'ActionCreated' });

    this.listenTo(activitiesView, {
      'remove:comment': this.onRemoveComment,
    });

    this.showContentView('activity', activitiesView);
    this.showFooterView('timestamps', new TimestampsView({ model: this.action, createdEvent }));
  },
  showNewCommentForm() {
    const clinician = Radio.request('bootstrap', 'currentUser');

    const newCommentFormView = this.showFooterView('comment', new CommentFormView({
      model: Radio.request('entities', 'comments:model', {
        _action: this.action.getResource(),
        _clinician: clinician.getResource(),
      }),
    }));

    this.listenTo(newCommentFormView, {
      'post:comment': this.onPostNewComment,
      'cancel:comment': this.onCancelNewComment,
    });
  },
  onPostNewComment({ model }) {
    model.set({ created_at: dayjs.utc().format() });

    model.save().then(() => {
      this.action.addComment(model);
      Radio.request('ws', 'add', model);
    });

    this.activityCollection.add(model);
    this.comments.add(model);

    this.showNewCommentForm();
  },
  onCancelNewComment() {
    this.showNewCommentForm();
  },
  onRemoveComment(model) {
    this.action.removeComment(model);

    Radio.request('ws', 'unsubscribe', model);
  },
  showAttachments() {
    const canUploadAttachments = !!Radio.request('settings', 'get', 'upload_attachments') && this.action.hasAllowedUploads();

    if (!canUploadAttachments && !this.attachments.length) return;

    const attachmentsView = new AttachmentsView({
      collection: this.attachments,
      canUploadAttachments,
      canRemoveAttachments: this.action.canEdit(),
    });

    this.listenTo(attachmentsView, {
      'add:attachment': this.onAddAttachment,
      'remove:attachment': this.onRemoveAttachment,
    });

    this.showContentView('attachments', attachmentsView);
  },
  onAddAttachment(file) {
    const attachment = this.attachments.add({
      _actions: [this.action.getResource()],
      _patient: this.action.getPatient().getResource(),
      created_at: dayjs.utc().format(),
    });
    attachment.upload(file);

    this.listenTo(attachment, {
      'upload:success': uploadedAttachment => {
        this.action.addFile(uploadedAttachment);
        Radio.request('ws', 'add', uploadedAttachment);
      },
      'upload:failed': () => {
        Radio.request('alert', 'show:error', intl.patients.patient.action.actionApp.uploadError);
      },
    });
  },
  onRemoveAttachment(model) {
    model.destroy();

    this.action.removeFile(model);

    Radio.request('ws', 'unsubscribe', model);
  },
  getSubscriptionResources() {
    return [
      this.action,
      this.currentFlow,
      ...this.comments.models,
      ...this.attachments.models,
    ].filter(Boolean);
  },
  subscribe() {
    Radio.request('ws', 'subscribe', this.getSubscriptionResources());
  },
  unsubscribe() {
    if (!this.comments || !this.attachments) return;

    Radio.request('ws', 'unsubscribe', this.getSubscriptionResources());
  },
  showContentView(name, view, options) {
    const contentView = this.getView().getChildView('content');
    const region = contentView.getRegion(name);
    region.show(view, options);
    return view;
  },
  showFooterView(name, view, options) {
    const footerView = this.getView().getChildView('footer');
    const region = footerView.getRegion(name);
    region.show(view, options);
    return view;
  },
});
