import Backbone from 'backbone';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';

import App from 'js/base/app';

import intl from 'js/i18n';

import { ACTION_SHARING } from 'js/static';

import { LayoutView, MenuView } from 'js/views/patients/sidebar/action/action-sidebar_views';
import { ActionView, ReadOnlyActionView } from 'js/views/patients/sidebar/action/action-sidebar-action_views';
import { FormLayoutView } from 'js/views/patients/sidebar/action/action-sidebar-forms_views';
import { CommentFormView } from 'js/views/patients/shared/comments_views';
import { ActivitiesView, TimestampsView } from 'js/views/patients/sidebar/action/action-sidebar-activity-views';
import { AttachmentsView } from 'js/views/patients/sidebar/action/action-sidebar-attachments-views';

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
    this.showAction();
  },
  onStateChangeCanDelete() {
    this.showMenu();
  },
  onBeforeStart({ action, isShowingForm }) {
    this.action = action;
    this.isShowingForm = isShowingForm;
    this.setAccess();

    this.setView(new LayoutView({ model: this.action }));

    const flow = this.action.getFlow();
    if (flow) this.listenTo(flow, 'change:_state', this.setAccess);

    this.listenTo(action, 'change:_owner', this.onChangeOwner);
    this.listenTo(action, 'message', this.onWebsocketMessage);

    this.showMenu();
    this.showAction();
    this.showForm();

    this.getRegion('activity').startPreloader();

    this.showView();
  },
  onBeforeStop() {
    const flow = this.action.getFlow();
    if (flow) this.stopListening(flow);
    this.stopListening(this.action);
  },
  beforeStart() {
    return [
      Radio.request('entities', 'fetch:actionEvents:collection', this.action.id),
      Radio.request('entities', 'fetch:comments:collection:byAction', this.action.id),
      Radio.request('entities', 'fetch:files:collection:byAction', this.action.id),
    ];
  },
  onWebsocketMessage({ category, payload }) {
    if (category !== 'CommentAdded') return;

    const { comment, relationships, attributes } = payload;

    const model = Radio.request('entities', 'comments:model', {
      id: comment.id,
      message: attributes.message,
      created_at: attributes.created_at,
      edited_at: attributes.edited_at,
      _clinician: relationships._clinician,
    });

    this.activityCollection.add(model);
  },
  onChangeOwner() {
    this.setAccess();
    /* istanbul ignore else : Covers edge case when owner changes prior to beforeStart */
    if (this.isRunning()) this.showAttachments();
  },
  onStart(options, activity, comments, attachments) {
    this.activityCollection = new Backbone.Collection([...activity.models, ...comments.models]);
    this.attachments = attachments;

    this.showActivity();
    this.showNewCommentForm();
    this.showAttachments();
  },
  viewEvents: {
    'close': 'stop',
  },
  showAction() {
    if (!this.getState('canEdit')) {
      this.showChildView('action', new ReadOnlyActionView({ model: this.action }));
      return;
    }

    const actionView = new ActionView({ model: this.action });

    this.listenTo(actionView, {
      'save': this.onSave,
    });

    this.showChildView('action', actionView);
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
  showForm() {
    if (!this.action.getForm() && !this.action.hasSharing()) return;

    const formView = this.showChildView('form', new FormLayoutView({
      model: this.action,
      isShowingForm: this.isShowingForm,
    }));

    this.listenTo(formView, {
      'click:form': this.onClickForm,
      'click:share': this.onClickShare,
      'click:cancelShare': this.onClickCancel,
      'click:undoCancelShare': this.onClickUndoCancel,
    });
  },
  showActivity() {
    this.showChildView('activity', new ActivitiesView({
      collection: this.activityCollection,
      model: this.action,
    }));
    const createdEvent = this.activityCollection.find({ event_type: 'ActionCreated' });

    this.showChildView('timestamps', new TimestampsView({ model: this.action, createdEvent }));
  },
  showNewCommentForm() {
    const clinician = Radio.request('bootstrap', 'currentUser');

    const newCommentFormView = this.showChildView('comment', new CommentFormView({
      model: Radio.request('entities', 'comments:model', {
        _action: this.action.id,
        _clinician: clinician.id,
      }),
    }));

    this.listenTo(newCommentFormView, {
      'post:comment': this.onPostNewComment,
      'cancel:comment': this.onCancelNewComment,
    });
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

    this.showChildView('attachments', attachmentsView);
  },
  onAddAttachment(file) {
    const attachment = this.attachments.add({
      _action: this.action.id,
      _patient: this.action.getPatient().id,
      created_at: dayjs.utc().format(),
    });
    attachment.upload(file);

    this.listenTo(attachment, 'upload:failed', () => {
      Radio.request('alert', 'show:error', intl.patients.sidebar.actionSidebarApp.uploadError);
    });
  },
  onRemoveAttachment(model) {
    model.destroy();
  },
  onSave({ model }) {
    this.action.save({ details: model.get('details') });
  },
  onDelete() {
    this.action.destroy({ wait: true })
      .then(() => {
        this.stop();
      })
      .catch(({ responseData }) => {
        Radio.request('alert', 'show:apiError', responseData);
      });
  },
  onStop() {
    this.action.trigger('editing', false);

    Radio.request('sidebar', 'close');
  },
  onClickForm(form) {
    Radio.trigger('event-router', 'form:patientAction', this.action.id, form.id);
  },
  onClickShare() {
    this.action.save({ sharing: ACTION_SHARING.PENDING });
  },
  onClickCancel() {
    this.action.save({ sharing: ACTION_SHARING.CANCELED });
  },
  onClickUndoCancel() {
    this.action.save({ sharing: ACTION_SHARING.PENDING });
  },
  onPostNewComment({ model }) {
    model.set({ created_at: dayjs.utc().format() }).save();
    this.activityCollection.add(model);
    this.showNewCommentForm();
  },
  onCancelNewComment() {
    this.showNewCommentForm();
  },
});
