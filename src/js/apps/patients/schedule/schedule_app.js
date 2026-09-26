import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import StateModel from './schedule_state';
import ResultsApp from './schedule-results_app';

import App from 'js/base/app';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';
import ListSidebarApp from 'js/apps/patients/shared/list-sidebar_app';

import DateFilter from 'js/apps/patients/shared/components/date-filter';
import SearchView from 'js/components/list-search';

import { LayoutView, ScheduleTitleView, AllFiltersButtonView } from 'js/apps/patients/schedule/schedule_views';

const ScheduleApp = App.extend({
  childApps: {
    sidebar: ListSidebarApp,
  },
  createState() {
    return new StateModel();
  },
  stateEvents: {
    'change:clinicianId': 'refreshList',
    'change:dateFilters': 'refreshList',
    'change:customFilters': 'refreshList',
    'change:states': 'refreshList',
    'change:flowStates': 'refreshList',
    'change:searchQuery': 'onChangeSearchQuery',
  },
  initialize() {
    const results = this.addChildApp('results', new ResultsApp({ state: this.getState() }));
    const sidebar = this.getChildApp('sidebar');
    this.listenTo(results, 'click:patient', patient => sidebar.selectPatient(patient));
    this.listenTo(sidebar, {
      'change:patient': patient => {
        results.setPatientSelected(patient?.id || null);
        if (patient) this.getView().showPatientSidebar();
      },
      'show:patient': () => {
        const view = this.getView();
        view.setDrawerCloseHidden(true);
        if (view.isFiltersDrawer()) sidebar.focusPatientClose();
      },
      'show:filters': this.onShowFilters,
      'close': () => results.focusPatientTrigger(),
    });
  },
  onBeforeStart() {
    this.stopListening(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this.listenTo(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this.initListState();

    const view = this.setView(new LayoutView({ model: this.getState() }));
    this.listenTo(view, {
      'change:filters-drawer': this.onChangeFiltersDrawer,
      'change:filters-sidebar-fixed': this.onChangeFiltersSidebarFixed,
      'close:sidebar-drawer': this.onCloseSidebarDrawer,
      'before:destroy': this.onBeforeDestroyPageView,
    });
    this.expandFixedFiltersSidebar(view.isFiltersSidebarFixed());
    view.render();

    this.showSearchView();
    this.showFiltersButtonView();
    this.showScheduleTitle();
    this.showDateFilter();

    this.showView();
  },
  async prepareStart(options, { signal }) {
    const view = this.getView();
    const [resultsStarted, sidebarStarted] = await Promise.all([
      this.getChildApp('results').start({
        region: view.getRegion('results'),
        filtersState: this.filterState,
      }),
      this.getChildApp('sidebar').start({
        region: view.getRegion('filtersSidebar'),
        filtersState: this.filterState,
        layoutState: view.getLayoutState(),
        isDrawer: view.isFiltersDrawer(),
      }),
    ]);
    signal.throwIfAborted();
    return resultsStarted && sidebarStarted && !view.isDestroyed();
  },
  onStop() {
    this.stopListening(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
  },
  onBeforeDestroy() {
    this.filterState?.setFiltersCount.cancel();
    this.filterState?.stopListening();
    this.filterState?.off();
  },
  onUnknownError() {
    this.getState().removeStore();
  },
  initListState() {
    const state = this.getState();
    const storedState = state.getStore();
    const currentUser = Radio.request('bootstrap', 'currentUser');

    state.restoreStore();
    state.set({
      ...state.defaults(),
      ...storedState,
      id: `schedule_${ currentUser.id }`,
      searchQuery: this.currentSearchQuery || '',
      lastSelectedIndex: null,
    });
    this.initFiltersState({ setDefaults: !storedState });
  },
  initFiltersState({ setDefaults }) {
    if (!this.filterState) {
      this.filterState = new FiltersStateModel(this.getState().getFiltersState());
      this.listenTo(this.filterState, 'change', (state, options) => {
        this.getState().set(state.getFiltersState(), options);
      });
    } else {
      this.filterState.set(this.getState().getFiltersState());
    }

    if (setDefaults) this.filterState.setDefaultFilterStates();
    this.getState().set(this.filterState.getFiltersState());
  },
  onChangeFiltersSidebarFixed(isFixed) {
    this.expandFixedFiltersSidebar(isFixed);
  },
  expandFixedFiltersSidebar(isFixed) {
    if (isFixed) this.getState().setFiltersSidebarCollapsed(false);
  },
  onBeforeDestroyPageView(view) {
    const results = this.getChildApp('results');
    const sidebar = this.getChildApp('sidebar');
    sidebar.releaseHost();
    results.stop().catch(addError);
    sidebar.stop().catch(addError);
    this.stopListening(view);
  },
  onShowFilters() {
    this.getView().showFiltersSidebar();
  },
  onClickFilters() {
    const sidebar = this.getChildApp('sidebar');
    if (sidebar.isPatientOpen()) {
      sidebar.showFilters().catch(addError);
      return;
    }
    if (this.getView().toggleFiltersSidebar()) this.filterState.trigger('expand:sections');
  },
  async onChangeFiltersDrawer(isDrawer) {
    const view = this.getView();
    const sidebar = this.getChildApp('sidebar');
    if (isDrawer && sidebar.isPatientOpen()) {
      if (!await sidebar.showFilters().catch(addError) || view.isDestroyed()) return;
      isDrawer = view.isFiltersDrawer();
    }
    sidebar.setDrawerMode(isDrawer);
    view.setSidebarCollapsed(isDrawer || (!sidebar.isPatientOpen() && this.getState().get('filtersSidebarCollapsed')));
  },
  async onCloseSidebarDrawer() {
    const view = this.getView();
    const sidebar = this.getChildApp('sidebar');
    const wasPatientOpen = sidebar.isPatientOpen();
    if (wasPatientOpen && (!await sidebar.showFilters().catch(addError) || view.isDestroyed())) return;

    view.setSidebarCollapsed(true);
    if (wasPatientOpen) this.getChildApp('results').focusPatientTrigger();
    else view.getChildView('filters').focus();
  },
  refreshList(state, value, options) {
    const results = this.getChildApp('results');
    if (!results.isRunning() || options?.source === results) return;

    this.filterState.set(this.getState().getFiltersState());
    return results.refreshList().catch(addError);
  },
  onChangeSearchQuery(state) {
    this.currentSearchQuery = state.get('searchQuery');
  },
  showSearchView() {
    const searchView = new SearchView({
      query: this.getState().get('searchQuery'),
    });

    this.listenTo(searchView, 'change:query', searchQuery => {
      this.getState().setSearchQuery(searchQuery);
    });

    this.getView().showChildView('search', searchView);
  },
  showFiltersButtonView() {
    const filtersButtonView = new AllFiltersButtonView({
      layoutState: this.getView().getLayoutState(),
      model: this.filterState,
    });

    this.listenTo(filtersButtonView, 'click', this.onClickFilters);

    this.getView().showChildView('filters', filtersButtonView);
  },
  showDateFilter() {
    const dateTypes = ['due_date'];

    const dateFilter = new DateFilter({
      dateTypes,
      stateOptions: this.getState().getDateFilters(),
    });

    dateFilter.listenTo(dateFilter.getState(), 'change', ({ attributes }) => {
      this.getState().setDateFilters(attributes);
    });

    this.getView().showChildView('dateFilter', dateFilter);
  },
  showScheduleTitle() {
    const scheduleTitleView = new ScheduleTitleView({ model: this.getState() });

    this.listenTo(scheduleTitleView, 'change:owner', ({ id }) => {
      this.getState().set({ clinicianId: id });
    });

    this.getView().showChildView('title', scheduleTitleView);
  },
});

export default ScheduleApp;
