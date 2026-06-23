import Radio from 'backbone.radio';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import FormComponent from './components/form_component';
import TeamComponent from 'js/components/team';
import DueDayComponent from './components/dueday_component';
import BehaviorComponent from './components/behavior_component';

let teamsCollection;

function getTeams() {
  if (teamsCollection) return teamsCollection;
  teamsCollection = Radio.request('bootstrap', 'teams');
  return teamsCollection;
}

const OwnerComponent = TeamComponent.extend({
  canClear: true,
  initialize({ owner, isFromFlow }) {
    this.collection = getTeams();

    if (isFromFlow) this.defaultText = intl.programs.shared.actionsView.ownerComponent.defaultText;

    this.setState({ selected: owner });
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:owner', selected);
  },
});

export {
  FormComponent,
  OwnerComponent,
  DueDayComponent,
  BehaviorComponent,
};
