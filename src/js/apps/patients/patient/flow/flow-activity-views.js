import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/loader.scss';
import 'scss/modules/skeleton.scss';

import { renderTemplate } from 'js/i18n';

import './patient-flow.scss';

const ProgramStartedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "programStarted")) name = name team = team program = program}}
  <span class="patient-flow__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const ClinicianAssignedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "clinicianAssigned")) name = name team = team to_name = to_clinician}}
  <span class="patient-flow__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const DetailsUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "detailsUpdated")) name = name team = team}}
  <span class="patient-flow__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const NameUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "nameUpdated")) name = name team = team to_name = value from_name = previous}}
  <span class="patient-flow__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const TeamAssignedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "teamAssigned")) name = name team = team to_team = to_team}}
  <span class="patient-flow__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const StateUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "stateUpdated")) name = name team = team to_state = to_state}}
  <span class="patient-flow__activity-date">{{formatDateTime date "AT_TIME"}}</span>
`;

const ActivityIconTemplate = hbs`{{far icon}}`;

const ACTIVITY_ICONS = {
  FlowProgramStarted: 'folder-open',
  FlowClinicianAssigned: 'circle-user',
  FlowDetailsUpdated: 'pen-to-square',
  FlowNameUpdated: 'pen-to-square',
  FlowTeamAssigned: 'circle-user',
  FlowStateUpdated: 'circle-exclamation',
};

const FlowActivityLoadingView = View.extend({
  className: 'patient-flow__activity-loading skeleton-loading',
  attributes: {
    'aria-busy': 'true',
    'role': 'status',
  },
  template: hbs`
    <span class="loader__text">{{ @intl.regions.preload.loading }}</span>
    <div class="patient-flow-loading__activity-items" aria-hidden="true">
      <span class="skeleton-loading__shape patient-flow-loading__activity-item"></span>
      <span class="skeleton-loading__shape patient-flow-loading__activity-item patient-flow-loading__activity-item--short"></span>
    </div>
  `,
});

const ActivityView = View.extend({
  className: 'patient-flow__activity-item',
  getTemplate() {
    const type = this.model.get('event_type');

    const Templates = {
      FlowProgramStarted: ProgramStartedTemplate,
      FlowClinicianAssigned: ClinicianAssignedTemplate,
      FlowDetailsUpdated: DetailsUpdatedTemplate,
      FlowNameUpdated: NameUpdatedTemplate,
      FlowTeamAssigned: TeamAssignedTemplate,
      FlowStateUpdated: StateUpdatedTemplate,
    };

    if (!Templates[type]) return hbs``;

    return Templates[type];
  },
  onRender() {
    const icon = ACTIVITY_ICONS[this.model.get('event_type')];
    if (!icon) return;

    this.$el.prepend(renderTemplate(ActivityIconTemplate, { icon }));
  },
  _getModelName(model) {
    return model ? model.get('name') : null;
  },
  templateContext() {
    const editor = this.model.getEditor();
    const editorTeam = editor && editor.getTeam();
    const clinician = this.model.getClinician();
    const program = this.model.getProgram();
    const team = this.model.getTeam();
    const state = this.model.getState();
    const sourceI18n = `patients.patient.flow.flowViews.activity.${ this.model.get('source') }`;

    return {
      name: this._getModelName(editor),
      team: this._getModelName(editorTeam),
      to_clinician: this._getModelName(clinician),
      to_team: this._getModelName(team),
      to_state: this._getModelName(state),
      program: this._getModelName(program),
      getI18nSource(key) {
        return `${ sourceI18n }.${ key }`;
      },
    };
  },
});

const ActivitiesView = CollectionView.extend({
  childView: ActivityView,
});

export { ActivitiesView, FlowActivityLoadingView };
