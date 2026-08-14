import { extend, get } from 'underscore';
import Radio from 'backbone.radio';

import intl, { renderTemplate } from 'js/i18n';

import App from 'js/base/app';

import StateModel from './worklist_state';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';

import BulkEditActionsApp from 'js/apps/patients/sidebar/bulk-edit/bulk-edit-actions_app';
import BulkEditFlowsApp from 'js/apps/patients/sidebar/bulk-edit/bulk-edit-flows_app';
import { ListFiltersPanelApp } from 'js/apps/patients/shared/list-filters/list-filters_app';
import ListPatientSidebarApp from 'js/apps/patients/shared/list-patient-sidebar_app';

import DateFilterComponent from 'js/apps/patients/shared/components/date-filter';
import SearchComponent from 'js/components/list-search';
import { CountView } from 'js/apps/patients/shared/list_views';
import { ListPageAppMixin } from 'js/apps/patients/shared/list-page';

import { getSortOptions } from './worklist_sort';

import { CountLoadingView, ListErrorView, ListLoadingView, ListUpdatingView, ListView, SelectAllView, LayoutView, ListTitleView, SidebarControlsView, SortDroplist, TypeToggleView, NoOwnerToggleView, AllFiltersButtonView } from 'js/apps/patients/worklist/worklist_views';
import { BulkEditFlowsSuccessTemplate, BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

const FiltersApp = App.extend({
  StateModel: FiltersStateModel,
});

const WorklistApp = App.extend({
  StateModel,
  childApps: {
    filters: {
      AppClass: FiltersApp,
      restartWithParent: false,
    },
    bulkEditActions: BulkEditActionsApp,
    bulkEditFlows: BulkEditFlowsApp,
    filtersSidebar: {
      AppClass: ListFiltersPanelApp,
      restartWithParent: false,
    },
    patientSidebar: {
      AppClass: ListPatientSidebarApp,
      restartWithParent: false,
    },
  },
  stateEvents: {
    'change:listType change:clinicianId change:teamId change:noOwner': 'restart',
    'change:customFilters change:states change:flowStates': 'restart',
    'change:actionsDateFilters change:flowsDateFilters': 'restart',
    'change:actionsSortId change:flowsSortId': 'onChangeStateSort',
    'change:actionsSelected change:flowsSelected': 'onChangeSelected',
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
  onChangeStateSort() {
    if (!this.isRunning()) return;

    const listView = this.getChildView('list');

    if (!listView?.setComparator) return;

    listView.setComparator(this.getComparator());
  },
  onChangeSelected() {
    this.toggleBulkSelect();
  },
  onChangeSearchQuery(state) {
    this.currentSearchQuery = state.get('searchQuery');
  },
  initListState() {
    const storedState = this.getState().getStore(this.worklistId);

    this.getState().setSearchQuery(this.currentSearchQuery);

    if (storedState) {
      this.setState(storedState);
      this.getState().setClinicianId(this.clinicianId);
      this.startFiltersApp();
      return;
    }

    this.setState({ id: this.worklistId });

    this.getState().setClinicianId(this.clinicianId);

    this.startFiltersApp({ setDefaults: true });
  },
  onBeforeStop() {
    this.collection = null;
    if (!this.isRestarting()) {
      this.isPatientSidebarOpen = false;
      this.patientSidebarPatientId = null;
      this.stopChildApp('filters');
      this.stopChildApp('filtersSidebar');
      this.stopChildApp('patientSidebar');
    }
  },
  onBeforeStart({ worklistId, clinicianId }) {
    if (this.isRestarting()) {
      const filtersApp = this.getChildApp('filters');

      filtersApp.setState(this.getState().getFiltersState());

      this.showFiltersButtonView();
      this.showTypeViews();
      this.showListUpdating();

      return;
    }

    this.isRefreshingList = false;

    this.worklistId = worklistId;
    this.clinicianId = clinicianId;
    this.initListState();

    this.setListPageView(new LayoutView({ model: this.getState() }));

    this.showDisabledSelectAll();
    this.showSearchView();
    this.showFiltersButtonView();
    this.mountFiltersSidebar();

    this.showTypeViews();
    this.showListLoading();

    this.showView();
  },
  showListLoading() {
    const loadingView = new ListLoadingView({ isFlowList: this.getState().isFlowType() });

    this.showSelectionBarChildView('count', new CountLoadingView());
    this.showChildView('list', loadingView);
    this.getRegion('listStatus').empty();
  },
  showListUpdating() {
    const listView = this.getChildView('list');

    if (!listView || !listView.setLoading) {
      this.isRefreshingList = false;
      this.showListLoading();
      return;
    }

    this.isRefreshingList = true;
    listView.setLoading(true);
    this.getRegion('listStatus').empty();
    this.showSelectionBarChildView('count', new ListUpdatingView({ isFlowList: this.getState().isFlowType() }));
  },
  showListError(isRefresh) {
    const errorView = new ListErrorView({ isRefresh });

    this.listenTo(errorView, 'retry', this.restart);

    if (isRefresh) {
      this.showChildView('listStatus', errorView);
      return;
    }

    this.getRegion('listStatus').empty();
    this.showChildView('list', errorView);
  },
  beforeStart() {
    if (this.isPatientSidebarOpen) this.listenToPatientSidebar();

    const isFlowType = this.getState().isFlowType();
    const entityRequest = isFlowType ? 'fetch:flows:collection' : 'fetch:actions:collection';

    const includes = ['patient', ...this.sortOptions.getInclude()];
    const fields = { patients: ['first_name', 'last_name', 'patient-fields', 'segment'] };
    this.filters = this.getState().getEntityFilter();

    if (!isFlowType) {
      fields.flows = ['name', 'state'];
      includes.push('flow');
    }

    this.query = {
      filter: this.filters,
      fields,
      include: includes.join(','),
    };

    return Radio.request('entities', entityRequest, { data: this.query });
  },
  onStart(options, collection) {
    this.isRefreshingList = false;
    this.getRegion('listStatus').empty();
    this.setWorklist(collection.getMeta('worklist'));

    this.collection = collection;
    this.filteredCollection = collection.clone();
    this.editableCollection = collection.clone();

    this.subscribe();

    this.listenTo(this.filteredCollection, 'reset', this.showCountView);
    this.showCountView();

    this.listenTo(this.editableCollection, 'reset', this.toggleBulkSelect);
    this.toggleBulkSelect();

    this.showList();
  },
  /* istanbul ignore next: error handling */
  onFail(options, error) {
    if (get(error, ['response', 'status']) === 400) {
      this.filterState.setDefaultFilterStates();
      return;
    }

    const listView = this.getChildView('list');

    if (this.isRefreshingList && listView && listView.setLoading) {
      listView.setLoading(false);
      this.getSelectionBarRegion('count').empty();
    }

    this.showListError(this.isRefreshingList);
    this.isRefreshingList = false;
  },
  setWorklist(worklist) {
    this.getState().setWorklist(worklist);
    const filtersState = this.getFiltersState();
    filtersState.set('worklist', worklist);
  },
  subscribe() {
    const isFlowType = this.getState().isFlowType();
    const entityType = isFlowType ? 'flows' : 'patient-actions';
    const filterType = isFlowType ? 'flows' : 'actions';

    Radio.request('ws', 'subscribe', this.collection.models, { filters: { [filterType]: this.filters } });
    Radio.request('ws', 'manage:add', this, this.collection, entityType, this.query);
  },
  // NOTE: Shows views dependent on getState().getType()
  showTypeViews() {
    this.showListTitle();
    this.showDateFilter();
    this.showSidebarControls();
  },
  showSidebarControls() {
    if (this.isPatientSidebarOpen) return;

    this.showTypeToggleView();
    this.showNoOwnerToggleView();
    this.showSortDroplist();
  },
  showList() {
    const collectionView = new ListView({
      collection: this.collection,
      editableCollection: this.editableCollection,
      selectedPatientId: this.patientSidebarPatientId,
      state: this.getState(),
      viewComparator: this.getComparator(),
    });

    this.listenTo(collectionView, {
      'filtered'(filtered) {
        this.filteredCollection.reset(filtered);
        this.editableCollection.reset(this._getListEditable(collectionView));
      },
      'change:canEdit'() {
        this.editableCollection.reset(this._getListEditable(collectionView));
      },
      'click:patient': this.showPatientSidebar,
    });

    this.showChildView('list', collectionView);
  },
  _getListEditable(list) {
    return list.children.reduce((models, { canEdit, model }) => {
      if (canEdit) models.push(model);
      return models;
    }, []);
  },
  getFiltersState() {
    const filtersApp = this.getChildApp('filters');
    return filtersApp.getState();
  },
  showFiltersButtonView() {
    const filtersButtonView = new AllFiltersButtonView({
      layoutState: this.layoutView.getLayoutState(),
      model: this.getFiltersState(),
    });

    this.listenTo(filtersButtonView, 'click', this.onClickFiltersButton);

    this.showChildView('filters', filtersButtonView);
  },
  mountFiltersSidebar() {
    const filtersState = this.getFiltersState();

    this.sidebarControlsView = new SidebarControlsView();

    this.startChildApp('filtersSidebar', {
      region: this.getRegion('filtersSidebar'),
      filtersState,
      collapsedState: this.getState(),
      isDrawer: this.layoutView.isFiltersDrawer(),
      controlsView: this.sidebarControlsView,
    });
  },
  showPatientSidebar(patient, triggerElement) {
    if (this.isPatientSidebarOpen && this.patientSidebarPatientId === patient.id) {
      this.closePatientSidebar();
      return;
    }

    this.isPatientSidebarOpen = true;
    this.patientSidebarPatientId = patient.id;
    this.patientSidebarTrigger = triggerElement;
    this.getChildView('list').setPatientSelected(patient.id);
    this.stopChildApp('filtersSidebar');
    this.stopChildApp('patientSidebar');
    this.setSidebarLayoutCollapsed(false);

    const patientSidebar = this.startChildApp('patientSidebar', {
      region: this.getRegion('filtersSidebar'),
      patient,
    });

    this.focusPatientSidebar(patientSidebar);
    this.listenToPatientSidebar();
  },
  showFiltersSidebar() {
    this.isPatientSidebarOpen = false;
    this.patientSidebarPatientId = null;
    this.getChildView('list').setPatientSelected(null);
    this.stopChildApp('patientSidebar');
    this.mountFiltersSidebar();
    this.showSidebarControls();
    this.restoreFiltersSidebarLayout();
  },
  toggleBulkSelect() {
    this.selected = this.getState().getSelected(this.editableCollection);
    this.showSelectAll();

    if (this.selected.length) {
      this.showBulkEdit();
      return;
    }

    this.stopBulkEdit();
  },
  onClickBulkCancel() {
    this.getState().clearSelected();
  },
  stopBulkEdit() {
    const appName = this.getState().isFlowType() ? 'bulkEditFlows' : 'bulkEditActions';
    this.stopChildApp(appName);
  },
  showBulkEdit() {
    const appName = this.getState().isFlowType() ? 'bulkEditFlows' : 'bulkEditActions';
    const app = this.getChildApp(appName);

    if (app.isRunning()) {
      app.updateCollection(this.selected);
      return;
    }

    this.startChildApp(appName, {
      region: this.getSelectionBarRegion('bulkEdit'),
      state: { collection: this.selected },
    });

    this.listenTo(app, {
      'cancel': this.onClickBulkCancel,
      'applyOwner'(owner) {
        this.selected.applyOwner(owner);
      },
      'save'(saveData) {
        const itemCount = this.selected.length;

        this.selected.save(saveData)
          .then(() => {
            this.showUpdateSuccess(itemCount);
            app.stop();
            this.getState().clearSelected();
          })
          .catch(() => {
            Radio.request('alert', 'show:error', intl.patients.worklist.worklistApp.bulkEditFailure);
            this.getState().clearSelected();
            this.restart();
          });
      },
    });
  },
  showUpdateSuccess(itemCount) {
    if (this.getState().isFlowType()) {
      Radio.request('alert', 'show:success', renderTemplate(BulkEditFlowsSuccessTemplate, { itemCount }));
      return;
    }

    Radio.request('alert', 'show:success', renderTemplate(BulkEditActionsSuccessTemplate, { itemCount }));
  },
  showDisabledSelectAll() {
    this.showSelectionBarChildView('selectAll', new SelectAllView({
      isDisabled: true,
      itemType: this.getState().isFlowType() ? 'flows' : 'actions',
    }));
  },
  showSelectAll() {
    if (!this.editableCollection.length) {
      this.showDisabledSelectAll();
      return;
    }

    const selectAllView = new SelectAllView({
      isSelectAll: this.selected.length === this.editableCollection.length,
      isSelectNone: !this.selected.length,
      itemType: this.getState().isFlowType() ? 'flows' : 'actions',
    });

    this.listenTo(selectAllView, 'click', this.onClickBulkSelect);

    this.showSelectionBarChildView('selectAll', selectAllView);
  },
  onClickBulkSelect() {
    if (this.selected.length === this.editableCollection.length) {
      this.getState().clearSelected();
      return;
    }

    this.getState().selectMultiple(this.editableCollection.map('id'));
  },
  getSortOption(sortId) {
    const opt = this.sortOptions.get(sortId);

    if (!opt) {
      const stateDefaults = this.getState().defaults();
      const defaultSortId = stateDefaults[`${ this.getState().getType() }SortId`];

      return this.sortOptions.get(defaultSortId);
    }

    return opt;
  },
  getComparator() {
    const sortId = this.getState().getSort();
    return this.getSortOption(sortId).getComparator();
  },
  showCountView() {
    const countView = new CountView({
      isFlowList: this.getState().isFlowType(),
      collection: this.collection,
      filteredCollection: this.filteredCollection,
    });

    this.showSelectionBarChildView('count', countView);
  },
  showDateFilter() {
    if (this.getState().getStaticDateFilter()) return;

    const dateTypes = this.getState().isFlowType() ? ['created_at', 'updated_at'] : ['created_at', 'updated_at', 'due_date'];

    const dateFilterComponent = new DateFilterComponent({
      dateTypes,
      state: this.getState().getDateFilters(),
    });

    this.listenTo(dateFilterComponent.getState(), 'change', ({ attributes }) => {
      this.getState().setDateFilters(attributes);
    });

    this.showChildView('dateFilter', dateFilterComponent);
  },
  showSortDroplist() {
    this.sortOptions = getSortOptions(this.getState().getType());

    const sortSelect = new SortDroplist({
      collection: this.sortOptions,
      state: { selected: this.getSortOption(this.getState().getSort()) },
    });

    this.listenTo(sortSelect.getState(), 'change:selected', (state, selected) => {
      this.getState().setSort(selected.id);
    });

    this.sidebarControlsView.showChildView('sort', sortSelect);
  },
  showListTitle() {
    const listTitleView = new ListTitleView({ model: this.getState() });

    this.listenTo(listTitleView, {
      'change:owner'({ id, type }) {
        if (type === 'teams') {
          this.setState({ teamId: id, clinicianId: null });
        } else {
          this.setState({ clinicianId: id, teamId: null });
        }
      },
    });

    this.showChildView('title', listTitleView);
  },
  showNoOwnerToggleView() {
    const currentClinician = Radio.request('bootstrap', 'currentUser');
    if (this.getState().id !== 'shared-by' || !currentClinician.can('app:worklist:clinician_filter')) return;

    const ownerToggleView = new NoOwnerToggleView({
      model: this.getState(),
    });

    this.listenTo(ownerToggleView, 'click', () => {
      this.toggleState('noOwner');
    });

    this.sidebarControlsView.showChildView('ownerToggle', ownerToggleView);
  },
  showTypeToggleView() {
    const typeToggleView = new TypeToggleView({
      isFlowList: this.getState().isFlowType(),
    });

    this.listenTo(typeToggleView, 'toggle:listType', listType => {
      this.getState().setType(listType);
    });

    this.sidebarControlsView.showChildView('toggle', typeToggleView);
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

extend(WorklistApp.prototype, ListPageAppMixin);

export default WorklistApp;
