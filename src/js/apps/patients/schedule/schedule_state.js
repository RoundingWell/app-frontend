import { clone, extend, omit, reduce } from 'underscore';
import dayjs from 'dayjs';
import { NIL as NIL_UUID } from 'uuid';

import Backbone from 'backbone';
import Radio from 'backbone.radio';

import localStore from 'js/utils/local-store';

import MultiselectStateMixin from 'js/mixins/multiselect-state_mixin';

import { RELATIVE_DATE_RANGES } from 'js/static';

const relativeRanges = new Backbone.Collection(RELATIVE_DATE_RANGES);

const STATE_VERSION = 'v6';

const StateModel = Backbone.Model.extend({
  defaults() {
    return {
      clinicianId: this.currentClinician.id,
      dateFilters: {
        dateType: 'due_date',
        selectedDate: null,
        selectedMonth: null,
        selectedWeek: null,
        relativeDate: null,
      },
      lastSelectedIndex: null,
      isSelectionMode: false,
      actionsSelected: {},
      searchQuery: '',
      worklist: null,
      filtersSidebarCollapsed: false,
    };
  },
  getFiltersState() {
    return {
      customFilters: this.get('customFilters'),
      states: this.get('states'),
      flowStates: this.get('flowStates'),
      worklist: this.getWorklist(),
      listType: this.getType(),
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
    return `schedule_${ this.currentClinician.id }_${ this.currentWorkspace.id }-${ STATE_VERSION }`;
  },
  getStore() {
    return localStore.get(this.getStoreKey());
  },
  removeStore() {
    localStore.remove(this.getStoreKey());
  },
  onChange() {
    localStore.set(this.getStoreKey(), omit(this.attributes, 'filtersCount', 'isSelectionMode', 'lastSelectedIndex', 'searchQuery'));
  },
  setFiltersSidebarCollapsed(isCollapsed) {
    return this.set('filtersSidebarCollapsed', isCollapsed);
  },
  setSearchQuery(searchQuery = '') {
    return this.set({
      searchQuery: searchQuery.length > 2 ? searchQuery : '',
      lastSelectedIndex: null,
    });
  },
  getType() {
    return 'actions';
  },
  getWorklist() {
    return this.get('worklist');
  },
  setWorklist(worklist) {
    return this.set('worklist', worklist);
  },
  setDateFilters(filters) {
    this.set('dateFilters', clone(filters));
  },
  getDateFilters() {
    return clone(this.get('dateFilters'));
  },
  formatDateRange(date, rangeType) {
    const dateFormat = 'YYYY-MM-DD';
    return `${ dayjs(date).startOf(rangeType).format(dateFormat) },${ dayjs(date).endOf(rangeType).format(dateFormat) }`;
  },
  getDateRange({ selectedDate, selectedMonth, selectedWeek, relativeDate }) {
    if (selectedDate) return this.formatDateRange(selectedDate, 'day');

    if (selectedMonth) return this.formatDateRange(selectedMonth, 'month');

    if (selectedWeek) return this.formatDateRange(selectedWeek, 'week');

    relativeDate = relativeDate || 'thismonth';
    const { prev, unit } = relativeRanges.get(relativeDate).pick('prev', 'unit');
    const relativeRange = dayjs().subtract(prev, unit);

    return this.formatDateRange(relativeRange, unit);
  },
  getEntityDateFilter() {
    const dateFilters = this.getDateFilters();
    if (dateFilters.relativeDate === 'alltime') return {};

    return {
      due_date: this.getDateRange(dateFilters),
    };
  },
  getEntityStatesFilter() {
    return {
      states: this.get('states').join() || NIL_UUID,
      flow_states: this.get('flowStates').join() || NIL_UUID,
    };
  },
  getOwner() {
    const clinician = this.get('clinicianId');

    return Radio.request('entities', 'clinicians:model', clinician);
  },
  getEntityOwnerFilter() {
    const clinician = this.get('clinicianId');

    return { clinicians: clinician };
  },
  getEntityCustomFilter() {
    const filtersState = this.get('customFilters');
    return reduce(filtersState, (filters, selected, slug) => {
      if (selected !== null) filters[`@${ slug }`] = selected;

      return filters;
    }, {});
  },
  getEntityFilter() {
    const filters = {};

    extend(filters, this.getEntityDateFilter());
    extend(filters, this.getEntityStatesFilter());
    extend(filters, this.getEntityOwnerFilter());
    extend(filters, this.getEntityCustomFilter());

    return filters;
  },
});

extend(StateModel.prototype, MultiselectStateMixin);

export default StateModel;
