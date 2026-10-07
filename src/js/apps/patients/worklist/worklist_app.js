import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import StateModel from './worklist_state';
import ResultsApp from './worklist-results_app';

import App from 'js/base/app';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';
import ListSidebarApp from 'js/apps/patients/shared/list-sidebar_app';

import DateFilter from 'js/apps/patients/shared/components/date-filter';
import SearchView from 'js/components/list-search';

import { LayoutView, ListTitleView, SidebarControlsView, AllFiltersButtonView } from 'js/apps/patients/worklist/worklist_views';

const WorklistApp = App.extend({
  childApps: {
    sidebar: ListSidebarApp,
  },
  createState() {
    return new StateModel();
  },
  stateEvents: {
    'change:listType': 'refreshList',
    'change:clinicianId': 'refreshList',
    'change:teamId': 'refreshList',
    'change:noOwner': 'refreshList',
    'change:customFilters': 'refreshList',
    'change:states': 'refreshList',
    'change:flowStates': 'refreshList',
    'change:actionsDateFilters': 'refreshList',
    'change:flowsDateFilters': 'refreshList',
    'change:searchQuery': 'onChangeSearchQuery',
  },
  viewEvents: {
    'change:filters-drawer': 'onChangeFiltersDrawer',
    'change:filters-sidebar-fixed': 'onChangeFiltersSidebarFixed',
    'close:sidebar-drawer': 'onCloseSidebarDrawer',
    'before:destroy': 'onBeforeDestroyPageView',
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
  onBeforeStart(app, { worklistId, clinicianId }) {
    this.stopListening(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this.listenTo(Radio.channel('event-router'), 'unknownError', this.onUnknownError);

    this.worklistId = worklistId;
    this.clinicianId = clinicianId;
    this.initListState();

    const view = this.setView(new LayoutView({ model: this.getState() }));
    this.expandFixedFiltersSidebar(view.isFiltersSidebarFixed());

    this.showSearchView();
    this.showFiltersButtonView();
    this.showListTitle();
    this.showDateFilter();

    this.showView();
  },
  onStart() {
    const view = this.getView();
    const results = this.getChildApp('results');
    results.start({
      region: view.getRegion('results'),
      filtersState: this.filterState,
    }).catch(error => results.handleRefreshError(error));
    this.getChildApp('sidebar').start({
      region: view.getRegion('filtersSidebar'),
      filtersState: this.filterState,
      layoutState: view.getLayoutState(),
      isDrawer: view.isFiltersDrawer(),
      ControlsView: SidebarControlsView,
      controlsOptions: { model: this.getState() },
    }).catch(addError);
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
    const storedState = state.getStore(this.worklistId);
    const restoredState = {
      ...state.defaults(),
      ...storedState,
      id: this.worklistId,
      searchQuery: this.currentSearchQuery || '',
      lastSelectedIndex: null,
    };
    if (this.clinicianId) restoredState.clinicianId = this.clinicianId;

    state.restoreStore();
    state.set(restoredState);
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
  onBeforeDestroyPageView() {
    this.stop();
  },
  onShowFilters() {
    this.getView().showFiltersSidebar();
  },
  onClickFilters() {
    const sidebar = this.getChildApp('sidebar');
    if (sidebar.isPatientOpen()) {
      sidebar.showFilters();
      return;
    }
    if (this.getView().toggleFiltersSidebar()) this.filterState.trigger('expand:sections');
  },
  onChangeFiltersDrawer(isDrawer) {
    const view = this.getView();
    const sidebar = this.getChildApp('sidebar');
    sidebar.setDrawerMode(isDrawer);
    if (isDrawer && sidebar.isPatientOpen()) sidebar.showFilters();
    view.setSidebarCollapsed(isDrawer || (!sidebar.isPatientOpen() && this.getState().get('filtersSidebarCollapsed')));
  },
  onCloseSidebarDrawer() {
    const view = this.getView();
    const sidebar = this.getChildApp('sidebar');
    const wasPatientOpen = sidebar.isPatientOpen();
    if (wasPatientOpen) sidebar.showFilters();

    view.setSidebarCollapsed(true);
    if (wasPatientOpen) this.getChildApp('results').focusPatientTrigger();
    else view.getChildView('filters').focus();
  },
  refreshList(state, value, options) {
    const results = this.getChildApp('results');
    if (options?.source === results) return;

    this.filterState.set(this.getState().getFiltersState());
    this.refreshControls();
    return results.refreshList();
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
  refreshControls() {
    const state = this.getState();
    if (state.hasChanged('clinicianId') || state.hasChanged('teamId')) this.showListTitle();
    if (!state.hasChanged('listType')) return;

    this.showDateFilter();
  },
  showDateFilter() {
    if (this.getState().getStaticDateFilter()) return;

    const dateTypes = this.getState().isFlowType() ? ['created_at', 'updated_at'] : ['created_at', 'updated_at', 'due_date'];

    const dateFilter = new DateFilter({
      dateTypes,
      stateOptions: this.getState().getDateFilters(),
    });

    dateFilter.listenTo(dateFilter.getState(), 'change', ({ attributes }) => {
      this.getState().setDateFilters(attributes);
    });

    this.getView().showChildView('dateFilter', dateFilter);
  },
  showListTitle() {
    const listTitleView = new ListTitleView({ model: this.getState() });

    this.listenTo(listTitleView, {
      'change:owner'({ id, type }) {
        if (type === 'teams') {
          this.getState().set({ teamId: id, clinicianId: null });
        } else {
          this.getState().set({ clinicianId: id, teamId: null });
        }
      },
    });

    this.getView().showChildView('title', listTitleView);
  },
});

export default WorklistApp;
