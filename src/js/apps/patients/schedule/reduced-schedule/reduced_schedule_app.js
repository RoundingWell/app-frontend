import { get } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import StateModel from './reduced_schedule_state';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';

import FiltersSidebarApp from 'js/apps/patients/sidebar/filters-sidebar_app';
import PatientSidebarApp from 'js/apps/patients/sidebar/patient-sidebar_app';

import SearchComponent from 'js/views/shared/components/list-search';

import { CountView } from 'js/views/patients/shared/list_views';

import { LayoutView, ScheduleTitleView, TableHeaderView, ScheduleListView, AllFiltersButtonView } from 'js/views/patients/schedule/schedule_views';
import { sidebarOptions } from 'js/views/patients/sidebar/patient/patient-sidebar_views';

const FiltersApp = App.extend({
  StateModel: FiltersStateModel,
});

export default App.extend({
  StateModel,
  childApps: {
    filters: {
      AppClass: FiltersApp,
      restartWithParent: false,
    },
    filtersSidebar: {
      AppClass: FiltersSidebarApp,
      restartWithParent: false,
    },
    patientSidebar: PatientSidebarApp,
  },
  stateEvents: {
    'change:customFilters change:states change:flowStates': 'restart',
    'change:searchQuery': 'onChangeSearchQuery',
  },
  startFiltersApp({ setDefaults } = {}) {
    const filtersApp = this.startChildApp('filters', { state: this.getState().getFiltersState() });

    this.filterState = filtersApp.getState();

    filtersApp.listenTo(this.filterState, 'change', () => {
      this.setState(this.filterState.getFiltersState());
    });

    if (setDefaults) this.filterState.setDefaultFilterStates();

    this.setState(this.filterState.getFiltersState());
  },
  onChangeSearchQuery(state) {
    this.currentSearchQuery = state.get('searchQuery');
  },
  initListState() {
    const storedState = this.getState().getStore();

    this.getState().setSearchQuery(this.currentSearchQuery);

    if (storedState) {
      this.setState(storedState);
      this.startFiltersApp();
      return;
    }

    const currentUser = Radio.request('bootstrap', 'currentUser');
    this.setState({ id: `reduced-schedule_${ currentUser.id }` });

    this.startFiltersApp({ setDefaults: true });
  },
  onBeforeStart() {
    if (this.isRestarting()) {
      this.getRegion('count').empty();

      this.getRegion('list').startPreloader();

      return;
    }

    this.initListState();

    this.setView(new LayoutView({
      isReduced: this.getState('isReduced'),
    }));

    this.showSearchView();
    this.showTableHeaders();
    this.showScheduleTitle();
    this.showFiltersButtonView();

    this.getRegion('list').startPreloader();

    this.showView();
  },
  onBeforeStop() {
    this.collection = null;
    if (!this.isRestarting()) this.stopChildApp('filters');
  },
  beforeStart() {
    const filter = this.getState().getEntityFilter();
    const fields = { flows: ['name', 'state'], patients: ['first_name', 'last_name'] };
    const include = 'patient,flow';
    return Radio.request('entities', 'fetch:actions:collection', { data: { filter, fields, include } });
  },
  onStart(options, collection) {
    this.setWorklist(collection.getMeta('worklist'));

    this.collection = collection;
    this.filteredCollection = collection.clone();

    this.listenTo(this.filteredCollection, 'reset', this.showCountView);
    this.showCountView();

    this.showList();
  },
  /* istanbul ignore next: error handling */
  onFail(options, error) {
    if (get(error, ['response', 'status']) === 400) {
      this.filterState.setDefaultFilterStates();
    }
  },
  setWorklist(worklist) {
    this.getState().setWorklist(worklist);
    const filtersState = this.getFiltersState();
    filtersState.set('worklist', worklist);
  },
  showList() {
    const scheduleListView = new ScheduleListView({
      collection: this.collection.groupByDate(),
      state: this.getState(),
    });

    this.listenTo(scheduleListView, {
      'filtered'(filtered) {
        this.filteredCollection.reset(filtered);
      },
      'click:patientSidebarButton'({ model }) {
        const patient = model.getPatient();
        const patientSidebar = this.getChildApp('patientSidebar');

        patientSidebar.stop();

        Radio.request('sidebar', 'start', patientSidebar, { patient }, sidebarOptions);
      },
    });

    this.showChildView('list', scheduleListView);
  },
  getFiltersState() {
    const filtersApp = this.getChildApp('filters');
    return filtersApp.getState();
  },
  showFiltersButtonView() {
    const filtersButtonView = new AllFiltersButtonView({
      model: this.getFiltersState(),
    });

    this.listenTo(filtersButtonView, 'click', this.showFiltersSidebar);

    this.showChildView('filters', filtersButtonView);
  },
  showFiltersSidebar() {
    const filtersState = this.getFiltersState();

    const sidebarApp = this.getChildApp('filtersSidebar');

    Radio.request('sidebar', 'start', sidebarApp, { filtersState });
  },
  showCountView() {
    const countView = new CountView({
      collection: this.collection,
      filteredCollection: this.filteredCollection,
    });

    this.showChildView('count', countView);
  },
  showTableHeaders() {
    const tableHeadersView = new TableHeaderView();

    this.showChildView('table', tableHeadersView);
  },
  showScheduleTitle() {
    this.showChildView('title', new ScheduleTitleView({
      model: this.getState(),
    }));
  },
  showSearchView() {
    const searchComponent = new SearchComponent({
      state: {
        query: this.getState('searchQuery'),
      },
    });

    this.listenTo(searchComponent.getState(), 'change:query', (state, searchQuery) => {
      this.getState().setSearchQuery(searchQuery);
    });

    this.showChildView('search', searchComponent);
  },
});
