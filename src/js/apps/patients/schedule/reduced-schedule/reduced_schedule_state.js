import { extend, reduce, omit } from 'underscore';
import store from 'store';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { NIL as NIL_UUID } from 'uuid';

const STATE_VERSION = 'v6';

export default Backbone.Model.extend({
  defaults() {
    return {
      isReduced: true,
      searchQuery: '',
      worklist: null,
    };
  },
  getFiltersState() {
    return {
      customFilters: this.get('customFilters'),
      states: this.get('states'),
      flowStates: this.get('flowStates'),
      listType: 'actions',
      worklist: this.getWorklist(),
    };
  },
  preinitialize() {
    this.currentClinician = Radio.request('bootstrap', 'currentUser');
    this.currentWorkspace = Radio.request('workspace', 'current');
  },
  initialize() {
    this.on('change', this.onChange);

    this.listenTo(Radio.channel('event-router'), 'unknownError', this.removeStore);
  },
  getStoreKey() {
    return `reduced-schedule_${ this.currentClinician.id }_${ this.currentWorkspace.id }-${ STATE_VERSION }`;
  },
  getStore() {
    return store.get(this.getStoreKey());
  },
  removeStore() {
    store.remove(this.getStoreKey());
  },
  onChange() {
    store.set(this.getStoreKey(), omit(this.attributes, 'filtersCount', 'searchQuery'));
  },
  setSearchQuery(searchQuery = '') {
    return this.set({
      searchQuery: searchQuery.length > 2 ? searchQuery : '',
      lastSelectedIndex: null,
    });
  },
  getEntityStatesFilter() {
    return {
      states: this.get('states').join() || NIL_UUID,
      flow_states: this.get('flowStates').join() || NIL_UUID,
    };
  },
  getWorklist() {
    return this.get('worklist');
  },
  setWorklist(worklist) {
    return this.set('worklist', worklist);
  },
  getOwner() {
    return this.currentClinician;
  },
  getEntityCustomFilter() {
    const filtersState = this.get('customFilters');
    return reduce(filtersState, (filters, selected, slug) => {
      if (selected !== null) filters[`@${ slug }`] = selected;

      return filters;
    }, {});
  },
  getEntityFilter() {
    const filters = {
      clinicians: this.currentClinician.id,
    };

    extend(filters, this.getEntityStatesFilter());
    extend(filters, this.getEntityCustomFilter());

    return filters;
  },
});
