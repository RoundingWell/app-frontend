import Radio from 'backbone.radio';

import App from 'js/base/app';

import StateModel from './reduced_schedule_state';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';

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
    patientSidebar: PatientSidebarApp,
  },
  stateEvents: {
    'change:customFilters change:states change:flowStates': 'restart',
    'change:searchQuery': 'onChangeSearchQuery',
  },
  startFiltersApp({ setDefaults } = {}) {
    const filtersApp = this.startChildApp('filters', { state: this.getState().getFiltersState() });

    const filterState = filtersApp.getState();

    filtersApp.listenTo(filterState, 'change', () => {
      this.setState(filterState.getFiltersState());
    });

    if (setDefaults) filterState.setDefaultFilterStates();

    this.setState(filterState.getFiltersState());
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
    return Radio.request('entities', 'fetch:actions:collection', { data: { filter } });
  },
  onStart(options, collection) {
    this.collection = collection;
    this.filteredCollection = collection.clone();

    this.listenTo(this.filteredCollection, 'reset', this.showCountView);
    this.showCountView();

    this.showList();
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
  showFiltersButtonView() {
    const filtersApp = this.getChildApp('filters');
    const filtersState = filtersApp.getState();

    const filtersButtonView = new AllFiltersButtonView({
      model: filtersState,
    });

    this.listenTo(filtersButtonView, 'click', () => {
      Radio.request('sidebar', 'start', 'filters', { filtersState });
    });

    this.showChildView('filters', filtersButtonView);
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
