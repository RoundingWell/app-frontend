import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import './patient-flow.scss';

const ProgramStartedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "programStarted")) name = name team = team program = program}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const ClinicianAssignedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "clinicianAssigned")) name = name team = team to_name = to_clinician}}
  <div>{{formatDateTime date "AT_TIME"}}</div>
`;

const DetailsUpdatedTemplate = hbs`
  {{formatHTMLMessage (intlGet (getI18nSource "detailsUpdated")) name = name team = team}}
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

export { ActivitiesView };
