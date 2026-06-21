import Radio from 'backbone.radio';

import BehaviorComponent from './components/behavior_component';
import TeamComponent from 'js/components/team';

const FlowBehaviorComponent = BehaviorComponent.extend({
  isConditionalAvailable: false,
  onPicklistSelect({ model }) {
    this.setState('selected', model);
    this.popRegion.empty();
  },
});

let teamsCollection;

function getTeams() {
  if (teamsCollection) return teamsCollection;
  teamsCollection = Radio.request('bootstrap', 'teams');
  return teamsCollection;
}

const OwnerComponent = TeamComponent.extend({
  canClear: true,
  initialize({ owner }) {
    this.collection = getTeams();

    this.setState({ selected: owner });
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:owner', selected);
  },
});

export {
  FlowBehaviorComponent,
  OwnerComponent,
};
