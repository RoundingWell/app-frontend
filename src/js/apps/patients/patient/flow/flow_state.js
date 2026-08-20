import { extend } from 'underscore';

import Backbone from 'backbone';

import MultiselectStateMixin from 'js/mixins/multiselect-state_mixin';

const StateModel = Backbone.Model.extend({
  defaults() {
    return {
      lastSelectedIndex: null,
      isSelectionMode: false,
      actionsSelected: {},
    };
  },
  getType() {
    return 'actions';
  },
});

extend(StateModel.prototype, MultiselectStateMixin);

export default StateModel;
