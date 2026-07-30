import dayjs from 'dayjs';

import Radio from 'backbone.radio';

import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import { alphaSort } from 'js/utils/sorting';

import { ACTION_SHARING } from 'js/static';
import { renderTemplate } from 'js/i18n';

import Tooltip from 'js/components/tooltip';

import { CommentFormView } from 'js/apps/patients/shared/comments_views';

import 'scss/modules/comments.scss';
import 'scss/modules/sidebar.scss';

import './action.scss';

const CreatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "created")) name = name team = team}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const ClinicianAssignedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "clinicianAssigned")) name = name team = team to_name = to_clinician}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const ActionCopiedFromProgramActionTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "actionCopiedFromProgram")) name = name team = team program = program source = source}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const DetailsUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "detailsUpdated")) name = name team = team}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const DueDateUpdatedTemplate = hbs`
  {{#unless value}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueDateCleared")) name = name team = team }}
  {{else}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueDateUpdated")) name = name team = team date = (formatDateTime value "LONG")}}
  {{/unless}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const DueTimeUpdatedTemplate = hbs`
  {{#unless value}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueTimeCleared")) name = name team = team }}
  {{else}}
  {{formatHTMLMessage (intlGet (getI18nSource "dueTimeUpdated")) name = name team = team time = (formatDateTime value "LT" inputFormat="HH:mm:ss")}}
  {{/unless}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const DurationUpdatedTemplate = hbs`
  {{#unless value}}
  {{formatHTMLMessage (intlGet (getI18nSource "durationCleared")) name = name team = team}}
  {{else}}
  {{formatHTMLMessage (intlGet (getI18nSource "durationUpdated")) name = name team = team duration = value}}
  {{/unless}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const FormUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "formUpdated")) name = name team = team form = form}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const FormRespondedTemplate = hbs`
  {{#if _editor}}
    {{formatHTMLMessage (intlGet (getI18nSource "formResponded")) name = name team = team form = form}}
  {{ else }}
    {{formatHTMLMessage (intlGet (getI18nSource "formRecipientResponded")) recipient = recipient form = form}}
  {{/if}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const NameUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "nameUpdated")) name = name team = team to_name = value from_name = previous}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const TeamAssignedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "teamAssigned")) name = name team = team to_team = to_team}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const StateUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "stateUpdated")) name = name team = team to_state = to_state}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const SharingCanceledTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "sharingCanceled")) name = name team = team}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const SharingSentTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "sharingSent")) recipient = recipient form = form}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const CommentView = View.extend({
  className: 'u-margin--b-16',
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
          {{#if canEdit}}<span class="js-edit comment__edit">{{far "pen"}} {{ @intl.patients.patient.action.activityViews.commentView.edit }}</span>{{/if}}
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
      if (sharing === ACTION_SHARING.CANCELED) return SharingCanceledTemplate;
    }

    if (!Templates[type]) return hbs``;

    return Templates[type];
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
  className: 'u-margin--t-24',
  template: hbs`
    <h3 class="sidebar__heading">
      {{far "timeline-arrow"}}<span class="u-margin--l-8">{{ @intl.patients.patient.action.activityViews.activityHeadingText }}</span>
    </h3>
    <div class="u-margin--t-16 sidebar__activity" data-activities-region></div>
  `,
  childViewContainer: '[data-activities-region]',
  childView(model) {
    return (model.type === 'events') ? ActivityView : CommentView;
  },
  childViewTriggers: {
    'remove:comment': 'remove:comment',
  },
  viewFilter({ model }) {
    if (model.get('event_type') === 'ActionCreated' && model.get('source') === 'system') return false;
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

const TimestampsView = View.extend({
  className: 'sidebar__footer flex',
  template: hbs`
    <div class="sidebar__footer-left"><h4 class="sidebar__label">{{ @intl.patients.patient.action.activityViews.createdAt }}</h4><div>{{formatDateTime createdAt "AT_TIME"}}</div></div>
    <div><h4 class="sidebar__label">{{ @intl.patients.patient.action.activityViews.updatedAt }}</h4><div>{{formatDateTime updated_at "AT_TIME"}}</div></div>
  `,
  templateContext() {
    return {
      createdAt: this.getOption('createdEvent').get('date'),
    };
  },
  modelEvents: {
    'change:updated_at': 'render',
  },
});

const LayoutView = View.extend({
  template: hbs`
    <div data-activities-region></div>
    <div class="u-margin--t-16" data-comment-form-region></div>
    <div class="u-margin--t-16" data-timestamps-region></div>
  `,
  regions: {
    activities: '[data-activities-region]',
    comment: '[data-comment-form-region]',
    timestamps: '[data-timestamps-region]',
  },
});

export {
  LayoutView,
  ActivitiesView,
  TimestampsView,
};
