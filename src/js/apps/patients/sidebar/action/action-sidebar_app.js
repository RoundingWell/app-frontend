import { extend } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';

import App from 'js/base/app';

import intl from 'js/i18n';

import { SidebarMixin } from 'js/services/sidebar';

import { SidebarView, MenuView, HeadingView, FooterView } from 'js/apps/patients/sidebar/action/action-sidebar_views';
import { ActionView, ReadOnlyActionView } from 'js/apps/patients/sidebar/action/action-sidebar-action_views';
import { DialerView } from 'js/apps/patients/sidebar/action/action-sidebar-dialer_views';
import { FormLayoutView } from 'js/apps/patients/sidebar/action/action-sidebar-forms_views';
import { CommentFormView } from 'js/apps/patients/shared/comments_views';
import { ActivitiesView, TimestampsView } from 'js/apps/patients/sidebar/action/action-sidebar-activity-views';
import { AttachmentsView } from 'js/apps/patients/sidebar/action/action-sidebar-attachments-views';

export default App.extend(extend({
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
    this.showAction();
    this.showDialer();
  },
  onStateChangeCanDelete() {
    this.showMenu();
  },
  onBeforeStart({ action, isShowingForm }) {
    this.action = action;
    this.isShowingForm = isShowingForm;
    this.setAccess();

    this.action.trigger('editing', true);
    const flow = this.action.getFlow();
    if (flow) this.listenTo(flow, 'change:_state', this.setAccess);

    this.listenTo(action, {
      'change:_owner': this.onChangeOwner,
      'destroy': this.onDestroy,
      'ws:add:comment': this.onWsAddComment,
      'ws:add:attachment': this.onWsAddAttachment,
    });

    this.showChildView('heading', new HeadingView({ model: this.action }));
    this.showContent();
    this.showChildView('footer', new FooterView());

    this.showMenu();
  },
  onBeforeStop() {
    const flow = this.action.getFlow();
    if (flow) this.stopListening(flow);
    this.stopListening(this.action);
    this.action.trigger('editing', false);

    this.removeSubscriptions();
  },
  beforeStart() {
    return [
      Radio.request('entities', 'fetch:actionEvents:collection', this.action.id),
      Radio.request('entities', 'fetch:comments:collection:byAction', this.action.id),
      Radio.request('entities', 'fetch:files:collection:byAction', this.action.id),
    ];
  },
  onChangeOwner() {
    this.setAccess();
    /* istanbul ignore else : Covers edge case when owner changes prior to beforeStart */
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

    // to cover the scenario where the AttachmentsView hasn't been shown yet
    if (this.attachments.length === 1) this.showAttachments();
  },
  onStart(options, activity, comments, attachments) {
    this.activityCollection = new Backbone.Collection([...activity.models, ...comments.models]);
    this.comments = comments;
    this.attachments = attachments;

    this.showActivity();
    this.showNewCommentForm();
    this.showAttachments();

    this.addSubscriptions();
  },
  showContent() {
    const sidebarView = new SidebarView({ model: this.action });

    this.showChildView('content', sidebarView);
    this.showAction();
    this.showForm();
    this.showDialer();

    sidebarView.getRegion('activity').startPreloader();
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
    this.triggerMethod('close', this);
  },
  showForm() {
    if (!this.action.getForm() && !this.action.hasSharing()) return;

    const formView = this.showContentView('form', new FormLayoutView({
      model: this.action,
      isShowingForm: this.isShowingForm,
    }));

    this.listenTo(formView, {
      'click:form': this.onClickForm,
    });
  },
  onClickForm(form) {
    Radio.trigger('event-router', 'form:patientAction', this.action.id, form.id);
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
        Radio.request('alert', 'show:error', intl.patients.sidebar.actionSidebarApp.uploadError);
      },
    });
  },
  onRemoveAttachment(model) {
    model.destroy();

    this.action.removeFile(model);

    Radio.request('ws', 'unsubscribe', model);
  },
  addSubscriptions() {
    Radio.request('ws', 'add', [...this.comments.models, ...this.attachments.models]);
  },
  removeSubscriptions() {
    // for when the sidebar is closed prior to beforeStart being able to finish
    if (!this.isRunning()) return;

    Radio.request('ws', 'unsubscribe', [...this.comments.models, ...this.attachments.models]);
  },
}, SidebarMixin));
