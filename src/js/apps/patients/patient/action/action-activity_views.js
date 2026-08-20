import dayjs from 'dayjs';

import Radio from 'backbone.radio';

import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/forms.scss';
import 'scss/modules/loader.scss';
import 'scss/modules/sidebar.scss';
import 'scss/modules/skeleton.scss';
import 'scss/modules/textarea-flex.scss';

import { alphaSort } from 'js/utils/sorting';

import { ACTION_SHARING } from 'js/static';
import { renderTemplate } from 'js/i18n';

import Tooltip from 'js/components/tooltip';

import { CommentFormView, PostCommentView } from 'js/apps/patients/shared/comments_views';

import './action.scss';

const CreatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "created")) name = name team = team}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const ClinicianAssignedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "clinicianAssigned")) name = name team = team to_name = to_clinician}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const ActionCopiedFromProgramActionTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "actionCopiedFromProgram")) name = name team = team program = program source = source}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const DetailsUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "detailsUpdated")) name = name team = team}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const DueDateUpdatedTemplate = hbs`
  {{#unless value}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueDateCleared")) name = name team = team }}
  {{else}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueDateUpdated")) name = name team = team date = (formatDateTime value "LONG")}}
  {{/unless}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const DueTimeUpdatedTemplate = hbs`
  {{#unless value}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueTimeCleared")) name = name team = team }}
  {{else}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueTimeUpdated")) name = name team = team time = (formatDateTime value "LT" inputFormat="HH:mm:ss")}}
  {{/unless}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const DurationUpdatedTemplate = hbs`
  {{#unless value}}
  {{formatHTMLMessage (intlGet (getI18nSource "durationCleared")) name = name team = team}}
  {{else}}
  {{formatHTMLMessage (intlGet (getI18nSource "durationUpdated")) name = name team = team duration = value}}
  {{/unless}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const FormUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "formUpdated")) name = name team = team form = form}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const FormRespondedTemplate = hbs`
  {{#if _editor}}
    {{formatHTMLMessage (intlGet (getI18nSource "formResponded")) name = name team = team form = form}}
  {{ else }}
    {{formatHTMLMessage (intlGet (getI18nSource "formRecipientResponded")) recipient = recipient form = form}}
  {{/if}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const NameUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "nameUpdated")) name = name team = team to_name = value from_name = previous}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const TeamAssignedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "teamAssigned")) name = name team = team to_team = to_team}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const StateUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "stateUpdated")) name = name team = team to_state = to_state}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const SharingCanceledTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "sharingCanceled")) name = name team = team}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const SharingSentTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "sharingSent")) recipient = recipient form = form}}
  <span class="patient-action__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const ActivityIconTemplate = hbs`{{far icon}}`;

const ACTIVITY_ICONS = {
  ActionClinicianAssigned: 'circle-user',
  ActionTeamAssigned: 'circle-user',
  ActionCreated: 'file-lines',
  ActionCopiedFromProgramAction: 'file-lines',
  ActionDetailsUpdated: 'pen-to-square',
  ActionDueDateUpdated: 'calendar-days',
  ActionDueTimeUpdated: 'clock',
  ActionDurationUpdated: 'stopwatch',
  ActionFormUpdated: 'square-poll-horizontal',
  ActionFormResponded: 'square-poll-horizontal',
  ActionNameUpdated: 'pen-to-square',
  ActionStateUpdated: 'circle-exclamation',
  ActionSharingUpdated: 'share-from-square',
};
const ACTIVITY_TYPES = Object.keys(ACTIVITY_ICONS);

const ActionActivityLoadingView = View.extend({
  className: 'patient-action__activity-layout patient-action__activity-loading skeleton-loading',
  attributes: {
    'aria-busy': 'true',
    'role': 'status',
  },
  template: hbs`
    <span class="loader__text">{{ @intl.regions.preload.loading }}</span>
    <h3 class="patient-detail-page__activity-heading">{{ @intl.patients.patient.action.activityViews.activityHeadingText }}</h3>
    <div class="patient-action-loading__activity-items" aria-hidden="true">
      <span class="skeleton-loading__shape patient-action-loading__activity-item"></span>
      <span class="skeleton-loading__shape patient-action-loading__activity-item patient-action-loading__activity-item--short"></span>
    </div>
  `,
});

const ActionCommentActionsView = PostCommentView.extend({
  className: 'patient-action__comment-actions',
  template: hbs`
    <button class="button button--positive patient-action__comment-post js-post" type="button" {{#if isDisabled}}disabled{{/if}}>
      {{ @intl.patients.shared.commentsViews.postCommentView.postBtn }}
    </button>
    {{#unless shouldHideCancel}}<button class="button button--text u-margin--r-4 js-cancel" type="button">{{ @intl.patients.shared.commentsViews.postCommentView.cancelBtn }}</button>{{/unless}}
  `,
});

const ActionCommentFormView = CommentFormView.extend({
  className: 'patient-action__comment-composer',
  template: hbs`
    <div class="patient-action__comment-input-wrap textarea-flex">
      <textarea class="form-input form-input--secondary textarea-flex__input patient-action__comment-input js-input" placeholder="{{ @intl.patients.shared.commentsViews.commentFormView.placeholder }}">{{ message }}</textarea>
      <div class="textarea-flex__mirror form-input form-input--secondary patient-action__comment-input js-spacer" aria-hidden="true">{{ message }}</div>
    </div>
    <div data-post-region></div>
  `,
  showPostView() {
    const shouldHideCancel = this.model.isNew() && !this.model.get('message');

    this.showChildView('post', new ActionCommentActionsView({
      model: this.model,
      shouldHideCancel,
    }));
  },
});

const CommentView = View.extend({
  className: 'patient-action__comment',
  ui: {
    edit: '.js-edit',
  },
  triggers: {
    'click @ui.edit': 'click:edit',
  },
  childViewTriggers: {
    'cancel:comment': 'cancel:edit',
    'post:comment': 'save:comment',
    'delete:comment': 'delete:comment',
  },
  regions: {
    comment: '[data-comment-activity-region]',
  },
  modelEvents: {
    'change:message': 'render',
  },
  template: hbs`
    <div data-comment-activity-region>
      <div class="comment__item">
        <div class="comment__author-label">{{ initials }}</div>
        <div class="comment__title">
          <span class="comment__author-name">{{ name }}</span>
          <span class="comment__timestamp" data-testid="action-comment-timestamp">{{ formatDateTime created_at "AT_TIME" }}</span>
          {{#if canEdit}}<button class="js-edit comment__edit" type="button">{{far "pen"}} {{ @intl.patients.patient.action.activityViews.commentView.edit }}</button>{{/if}}
        </div>
        <div class="comment__message">{{ message }}{{#if edited_at}}<span class="comment__edited"> {{ @intl.patients.patient.action.activityViews.commentView.edited }} </span>{{/if}}</div>
      </div>
    </div>
  `,
  templateContext() {
    const clinician = this.model.getClinician();
    const currentUser = Radio.request('bootstrap', 'currentUser');

    return {
      canEdit: clinician.id === currentUser.id,
      name: clinician.get('name'),
      initials: clinician.getInitials(),
    };
  },
  onRender() {
    const edited = this.model.get('edited_at');
    if (!edited) return;

    const template = hbs`{{formatHTMLMessage (intlGet "patients.patient.action.activityViews.commentView.editTooltip")  edited = (formatDateTime edited "TIME") }}`;

    new Tooltip({
      messageHtml: renderTemplate(template, { edited }),
      uiView: this,
      ui: this.ui.edit,
    });
  },
  onClickEdit() {
    this.showChildView('comment', new CommentFormView({ model: this.model.clone() }));
  },
  onSaveComment({ model }) {
    this.model.save({
      message: model.get('message'),
      edited_at: dayjs.utc().format(),
    });
    this.render();
  },
  onCancelEdit() {
    this.render();
  },
  onDeleteComment() {
    this.triggerMethod('remove:comment', this.model);
  },
});

const ActivityView = View.extend({
  className: 'patient-action__activity-item',
  getTemplate() {
    const type = this.model.get('event_type');
    const Templates = {
      ActionClinicianAssigned: ClinicianAssignedTemplate,
      ActionCreated: CreatedTemplate,
      ActionDetailsUpdated: DetailsUpdatedTemplate,
      ActionDueDateUpdated: DueDateUpdatedTemplate,
      ActionDueTimeUpdated: DueTimeUpdatedTemplate,
      ActionDurationUpdated: DurationUpdatedTemplate,
      ActionFormUpdated: FormUpdatedTemplate,
      ActionFormResponded: FormRespondedTemplate,
      ActionNameUpdated: NameUpdatedTemplate,
      ActionCopiedFromProgramAction: ActionCopiedFromProgramActionTemplate,
      ActionTeamAssigned: TeamAssignedTemplate,
      ActionStateUpdated: StateUpdatedTemplate,
    };

    if (type === 'ActionSharingUpdated') {
      const sharing = this.model.get('value');
      if (sharing === ACTION_SHARING.SENT) return SharingSentTemplate;
      return SharingCanceledTemplate;
    }

    return Templates[type];
  },
  onRender() {
    const icon = ACTIVITY_ICONS[this.model.get('event_type')];
    this.$el.prepend(renderTemplate(ActivityIconTemplate, { icon }));
  },
  _getModelName(model) {
    return model ? model.get('name') : null;
  },
  templateContext() {
    const recipient = this.model.getRecipient();
    const editor = this.model.getEditor();
    const editorTeam = editor && editor.getTeam();
    const clinician = this.model.getClinician();
    const program = this.model.getProgram();
    const form = this.model.getForm();
    const team = this.model.getTeam();
    const state = this.model.getState();
    const sourceI18n = `patients.patient.action.activityViews.${ this.model.get('source') }`;

    return {
      recipient: recipient ? `${ recipient.get('first_name') } ${ recipient.get('last_name') }` : null,
      name: this._getModelName(editor),
      team: this._getModelName(editorTeam),
      to_clinician: this._getModelName(clinician),
      to_team: this._getModelName(team),
      to_state: this._getModelName(state),
      program: this._getModelName(program),
      form: this._getModelName(form),
      getI18nSource(key) {
        return `${ sourceI18n }.${ key }`;
      },
    };
  },
});

const ActivitiesView = CollectionView.extend({
  className: 'patient-action__activity-list patient-detail-page__activity-list',
  template: hbs`
    <h3 class="sidebar__heading patient-detail-page__activity-heading">
      {{ @intl.patients.patient.action.activityViews.activityHeadingText }}
    </h3>
    <div class="patient-action__activity-items" data-activities-region></div>
  `,
  childViewContainer: '[data-activities-region]',
  childView(model) {
    return (model.type === 'events') ? ActivityView : CommentView;
  },
  childViewTriggers: {
    'remove:comment': 'remove:comment',
  },
  viewFilter({ model }) {
    if (model.type !== 'events') return true;
    if (!ACTIVITY_TYPES.includes(model.get('event_type'))) return false;
    if (model.get('event_type') === 'ActionCreated' && model.get('source') === 'system') return false;
    if (model.get('event_type') === 'ActionSharingUpdated') {
      return [ACTION_SHARING.SENT, ACTION_SHARING.CANCELED].includes(model.get('value'));
    }
    return true;
  },
  viewComparator(viewA, viewB) {
    return alphaSort('asc', this._getSortDate(viewA.model), this._getSortDate(viewB.model));
  },
  _getSortDate(model) {
    if (model.get('date')) return model.get('date');

    return model.get('created_at');
  },
});

const LayoutView = View.extend({
  className: 'patient-action__activity-layout',
  template: hbs`
    <div data-activities-region></div>
    <div class="patient-action__comment-form" data-comment-form-region></div>
  `,
  regions: {
    activities: '[data-activities-region]',
    comment: '[data-comment-form-region]',
  },
});

export {
  ActionActivityLoadingView,
  ActionCommentFormView,
  LayoutView,
  ActivitiesView,
};
