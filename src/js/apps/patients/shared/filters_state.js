import { sortBy, isEqual, omit, size, isNull, clone, intersection, debounce, without } from 'underscore';

import Backbone from 'backbone';
import Radio from 'backbone.radio';

export default Backbone.Model.extend({
  preinitialize() {
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();
    const { done, notDone } = states.groupByDone();
    this.states = { done, notDone, all: states };
  },
  defaults() {
    const isDoneOnly = this.get('isDoneOnly');
    const doneStates = this.states.done.map('id');
    const notDoneStates = this.states.notDone.map('id');

    return {
      customFilters: {},
      states: isDoneOnly ? doneStates : notDoneStates,
      flowStates: notDoneStates,
    };
  },
  initialize() {
    this.set({
      customFiltersExpanded: true,
      flowStatesExpanded: false,
      statesExpanded: false,
    }, { silent: true });

    this.initStates();

    this.setFiltersCount = debounce(this.setFiltersCount, 30);

    this.on('change:customFilters change:states change:flowStates change:listType', this.setFiltersCount);

    this.setFiltersCount();
  },
  isFlowType() {
    return this.get('listType') === 'flows';
  },
  initStates() {
    const availableStateIds = this.getAvailableStates().map('id');

    // Remove any localstorage states no longer available
    this.set({
      states: intersection(this.get('states'), availableStateIds),
      flowStates: intersection(this.get('flowStates'), availableStateIds),
    });
  },
  getFiltersState() {
    return {
      filtersCount: this.get('filtersCount'),
      customFilters: this.get('customFilters'),
      states: this.get('states'),
      flowStates: this.get('flowStates'),
    };
  },
  _isSameIds(ids1, ids2) {
    return isEqual(sortBy(ids1), sortBy(ids2));
  },
  setFiltersCount() {
    const { states, flowStates } = this.defaults();

    const customFiltersCount = size(omit(this.get('customFilters'), isNull));

    const statesFilterSize = !this._isSameIds(this.get('states'), states) ? 1 : 0;

    if (this.isFlowType()) return this.set('filtersCount', customFiltersCount + statesFilterSize);

    const flowStatesFilterSize = !this._isSameIds(this.get('flowStates'), flowStates) ? 1 : 0;

    return this.set('filtersCount', customFiltersCount + statesFilterSize + flowStatesFilterSize);
  },
  getAvailableStates() {
    return this.get('isDoneOnly') ? this.states.done : this.states.all;
  },
  setDefaultFilterStates() {
    return this.set(this.defaults());
  },
  selectStatesFilter(stateId, shouldSelect, stateType) {
    const selectedStates = clone(this.get(`${ stateType }`));

    if (!shouldSelect) {
      return this.set(stateType, without(selectedStates, stateId));
    }

    return this.set(stateType, [...selectedStates, stateId]);
  },
  getFilter(name) {
    return this.get('customFilters')[name];
  },
  setFilter(name, value) {
    const customFilters = clone(this.get('customFilters'));
    customFilters[name] = value;
    return this.set('customFilters', customFilters);
  },
});
