import { extend, get } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import intl, { renderTemplate } from 'js/i18n';

import App from 'js/base/app';

import StateModel from './worklist_state';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';

import BulkEditActionsApp from 'js/apps/patients/shared/bulk-edit/bulk-edit-actions_app';
import BulkEditFlowsApp from 'js/apps/patients/shared/bulk-edit/bulk-edit-flows_app';
import { ListFiltersPanelApp } from 'js/apps/patients/shared/list-filters/list-filters_app';
import ListPatientSidebarApp from 'js/apps/patients/shared/list-patient-sidebar_app';

import DateFilter from 'js/apps/patients/shared/components/date-filter';
import SearchView from 'js/components/list-search';
import { CountView } from 'js/apps/patients/shared/list_views';
import { ListPageAppMixin } from 'js/apps/patients/shared/list-page';

import { getSortOptions } from './worklist_sort';

import { CountLoadingView, ListErrorView, ListLoadingView, ListUpdatingView, ListView, SelectAllView, LayoutView, ListTitleView, SidebarControlsView, SortDroplist, TypeToggleView, NoOwnerToggleView, AllFiltersButtonView } from 'js/apps/patients/worklist/worklist_views';
import { BulkEditFlowsSuccessTemplate, BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

const FiltersApp = App.extend({
  createState({ stateOptions }) {
    return new FiltersStateModel(stateOptions);
  },
});

const WorklistApp = App.extend({
  childApps: {
    filtersSidebar: ListFiltersPanelApp,
    patientSidebar: ListPatientSidebarApp,
  },
  createState() {
    return new StateModel();
  },
  onUnknownError() {
    this.getState().removeStore();
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
    'change:actionsSortId': 'onChangeStateSort',
    'change:flowsSortId': 'onChangeStateSort',
    'change:actionsSelected': 'onChangeSelected',
    'change:flowsSelected': 'onChangeSelected',
    'change:searchQuery': 'onChangeSearchQuery',
  },
  initFiltersApp({ setDefaults } = {}) {
    if (this.hasChildApp('filters')) {
      this.filterState.set(this.getState().getFiltersState());

      if (setDefaults) this.filterState.setDefaultFilterStates();
      this.getState().set(this.filterState.getFiltersState());
      return;
    }

    const filtersApp = this.addChildApp('filters', new FiltersApp({
      stateOptions: this.getState().getFiltersState(),
    }));

    this.filterState = filtersApp.getState();

    filtersApp.listenTo(this.filterState, 'change', () => {
      this.getState().set(this.filterState.getFiltersState());
    });

    if (setDefaults) this.filterState.setDefaultFilterStates();
    this.getState().set(this.filterState.getFiltersState());
  },
  onChangeStateSort() {
    if (!this.isRunning()) return;

    const listView = this.getView().getChildView('list');

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

    this.getState().restoreStore();
    this.getState().set(this.getState().defaults(), { silent: true });
    this.getState().setSearchQuery(this.currentSearchQuery);

    if (storedState) {
      this.getState().set(storedState);
      this.getState().setClinicianId(this.clinicianId);
      this.initFiltersApp();
      return;
    }

    this.getState().set({ id: this.worklistId });

    this.getState().setClinicianId(this.clinicianId);

    this.initFiltersApp({ setDefaults: true });
  },
  onStop() {
    this.stopListening(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this._canRefresh = false;
    this._patientSidebarRequest = null;
    this._refreshController?.abort();
    this._refreshController = null;
    if (this.filteredCollection) this.stopListening(this.filteredCollection);
    if (this.editableCollection) this.stopListening(this.editableCollection);
    this.collection = null;
    this.filteredCollection = null;
    this.editableCollection = null;
    this.isPatientSidebarOpen = false;
    this.patientSidebarPatientId = null;
  },
  onBeforeStart(app, { worklistId, clinicianId }) {
    this.stopListening(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this.listenTo(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this._canRefresh = false;
    this.isRefreshingList = false;

    this.worklistId = worklistId;
    this.clinicianId = clinicianId;
    this.initListState();

    this.setListPageView(new LayoutView({ model: this.getState() })).render();

    this.showDisabledSelectAll();
    this.showSearchView();
    this.showFiltersButtonView();

    this.showListLoading();
    this.showView();
  },
  showListLoading() {
    const loadingView = new ListLoadingView({ isFlowList: this.getState().isFlowType() });

    this.showSelectionBarChildView('count', new CountLoadingView());
    this.getView().showChildView('list', loadingView);
    this.getView().getRegion('listStatus').empty();
  },
  showListUpdating() {
    const listView = this.getView().getChildView('list');

    if (!listView || !listView.setLoading) {
      this.isRefreshingList = false;
      this.showListLoading();
      return;
    }

    this.isRefreshingList = true;
    listView.setLoading(true);
    this.getView().getRegion('listStatus').empty();
    this.showSelectionBarChildView('count', new ListUpdatingView({ isFlowList: this.getState().isFlowType() }));
  },
  showListError(isRefresh) {
    const errorView = new ListErrorView({ isRefresh });

    this.listenTo(errorView, {
      'destroy'() {
        this.stopListening(errorView);
      },
      'retry': this.refreshList,
    });

    if (isRefresh) {
      this.getView().showChildView('listStatus', errorView);
      return;
    }

    this.getView().getRegion('listStatus').empty();
    this.getView().showChildView('list', errorView);
  },
  prepareStart(options, { signal }) {
    if (this.isPatientSidebarOpen) this.listenToPatientSidebar();

    return this.getChildApp('filters').start()
      .then(() => this.loadCollection({ signal }))
      .catch(error => {
        if (signal.aborted) throw error;

        if (get(error, ['response', 'status']) !== 400) return null;

        this.filterState.setDefaultFilterStates();
        return this.loadCollection({ signal }).catch(retryError => {
          if (signal.aborted) throw retryError;
          return null;
        });
      });
  },
  loadCollection({ signal } = {}) {
    const isFlowType = this.getState().isFlowType();
    const entityRequest = isFlowType ? 'fetch:flows:collection' : 'fetch:actions:collection';
    this.sortOptions = getSortOptions(this.getState().getType());

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

    return Radio.request('entities', entityRequest, { data: this.query, signal });
  },
  onStart(app, options, collection) {
    if (!collection) {
      this.showInitialControls();
      this.showListError(false);
      this.showView();
      this._canRefresh = true;
      return;
    }

    this.showCollection(collection);
    this.showInitialControls();
    this.showView();
    this._canRefresh = true;
  },
  showInitialControls() {
    this.mountFiltersSidebar().catch(addError);
    this.showTypeViews();
  },
  showCollection(collection) {
    this.isRefreshingList = false;
    this.getView().getRegion('listStatus').empty();
    this.setWorklist(collection.getMeta('worklist'));

    if (this.filteredCollection) this.stopListening(this.filteredCollection);
    if (this.editableCollection) this.stopListening(this.editableCollection);
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
  async refreshList() {
    if (!this._canRefresh) return;

    this._refreshController?.abort();
    const controller = new AbortController();
    this._refreshController = controller;

    try {
      if (!await this.prepareListRefresh(controller)) return;

      const collection = await this.loadCollection({ signal: controller.signal });
      if (!this.isCurrentRefresh(controller)) return;

      this.showCollection(collection);
    } catch(error) {
      if (this.isCurrentRefresh(controller)) this.handleRefreshError(error);
    } finally {
      if (this._refreshController === controller) this._refreshController = null;
    }
  },
  async prepareListRefresh(controller) {
    if (!await this.stopBulkEditForRefresh() || !this.isCurrentRefresh(controller)) return false;

    this.filterState.set(this.getState().getFiltersState());
    this.showFiltersButtonView();
    this.showTypeViews();
    this.showListUpdating();
    return true;
  },
  async stopBulkEditForRefresh() {
    await this.stopBulkEdit();
    return this._canRefresh;
  },
  isCurrentRefresh(controller) {
    return !controller.signal.aborted && this._refreshController === controller;
  },
  handleRefreshError(error) {
    if (get(error, ['response', 'status']) === 400) {
      this.filterState.setDefaultFilterStates();
      return;
    }

    const listView = this.getView().getChildView('list');
    if (this.isRefreshingList && listView?.setLoading) {
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

    this.stopListening(Radio.channel('ws'));
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
      'destroy'() {
        this.stopListening(collectionView);
      },
      'filtered'(filtered) {
        this.filteredCollection.reset(filtered);
        this.editableCollection.reset(this._getListEditable(collectionView));
      },
      'change:canEdit'() {
        this.editableCollection.reset(this._getListEditable(collectionView));
      },
      'click:patient': this.showPatientSidebar,
    });

    this.getView().showChildView('list', collectionView);
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
      layoutState: this.getView().getLayoutState(),
      model: this.getFiltersState(),
    });

    this.listenTo(filtersButtonView, 'click', this.onClickFiltersButton);

    this.getView().showChildView('filters', filtersButtonView);
  },
  mountFiltersSidebar() {
    const filtersState = this.getFiltersState();

    this.sidebarControlsView = new SidebarControlsView();

    return this.getChildApp('filtersSidebar').start({
      filtersState,
      layoutState: this.getView().getLayoutState(),
      isDrawer: this.getView().isFiltersDrawer(),
      controlsView: this.sidebarControlsView,
      region: this.getView().getRegion('filtersSidebar'),
    });
  },
  showPatientSidebar(patient, triggerView) {
    if (this.isPatientSidebarOpen && this.patientSidebarPatientId === patient.id) {
      this.closePatientSidebar();
      return;
    }

    const request = {};
    this._patientSidebarRequest = request;
    this.isPatientSidebarOpen = true;
    this.patientSidebarPatientId = patient.id;
    this.patientSidebarTrigger = triggerView;
    this.getView().getChildView('list').setPatientSelected(patient.id);

    return this.startPatientSidebar(request, patient)
      .catch(error => this.handlePatientSidebarRequestError(request, error));
  },
  async startPatientSidebar(request, patient) {
    await this.getChildApp('filtersSidebar')?.stop();
    await this.getChildApp('patientSidebar')?.stop();
    if (this._patientSidebarRequest !== request) return;
    this.setSidebarLayoutCollapsed(false);

    const patientSidebar = this.getChildApp('patientSidebar');
    this.listenToPatientSidebar();

    await patientSidebar.start({
      patient,
      region: this.getView().getRegion('filtersSidebar'),
    });

    if (this._patientSidebarRequest !== request) return;
    this.focusPatientSidebar(patientSidebar);
  },
  handlePatientSidebarRequestError(request, error) {
    if (this._patientSidebarRequest !== request) return;
    this.handlePatientSidebarError(error);
  },
  handlePatientSidebarError(error) {
    this.showFiltersSidebar().catch(addError);

    if (error?.responseData) {
      Radio.request('alert', 'show:apiError', error.responseData);
      return;
    }

    addError(error);
  },
  async showFiltersSidebar() {
    this._patientSidebarRequest = null;
    this.isPatientSidebarOpen = false;
    this.patientSidebarPatientId = null;
    this.getView().getChildView('list').setPatientSelected(null);
    await this.getChildApp('patientSidebar')?.stop();
    await this.mountFiltersSidebar();
    this.showSidebarControls();
    this.restoreFiltersSidebarLayout();
  },
  toggleBulkSelect() {
    if (!this.editableCollection) return;

    this.selected = this.getState().getSelected(this.editableCollection);
    this.showSelectAll();

    if (this.selected.length) {
      this.showBulkEdit();
      return;
    }

    this.stopBulkEdit().catch(addError);
  },
  onClickBulkCancel() {
    this.getState().clearSelected();
  },
  stopBulkEdit() {
    return Promise.all([
      this.getChildApp('bulkEditActions')?.stop(),
      this.getChildApp('bulkEditFlows')?.stop(),
    ]);
  },
  showBulkEdit() {
    const appName = this.getState().isFlowType() ? 'bulkEditFlows' : 'bulkEditActions';
    const AppClass = this.getState().isFlowType() ? BulkEditFlowsApp : BulkEditActionsApp;
    const currentApp = this.getChildApp(appName);

    const app = currentApp || this.addChildApp(appName, new AppClass({
      stateOptions: { collection: this.selected },
    }));

    if (!currentApp) {
      this.listenTo(app, {
        'cancel': this.onClickBulkCancel,
        'applyOwner'(owner) {
          this.selected.applyOwner(owner);
        },
        'save'(saveData) {
          const itemCount = this.selected.length;

          this.selected.save(saveData)
            .then(() => {
              app.resetChanges();
              this.showUpdateSuccess(itemCount);
              this.getState().clearSelected();
            })
            .catch(() => {
              app.resetChanges();
              Radio.request('alert', 'show:error', intl.patients.worklist.worklistApp.bulkEditFailure);
              this.getState().clearSelected();
              this.refreshList();
            });
        },
      });
    }

    app.updateCollection(this.selected);
    app.start({
      collection: this.selected,
      region: this.getSelectionBarRegion('bulkEdit'),
    }).catch(addError);
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

    const dateFilter = new DateFilter({
      dateTypes,
      stateOptions: this.getState().getDateFilters(),
    });

    this.listenTo(dateFilter.getState(), 'change', ({ attributes }) => {
      this.getState().setDateFilters(attributes);
    });

    this.getView().showChildView('dateFilter', dateFilter);
  },
  showSortDroplist() {
    this.sortOptions = getSortOptions(this.getState().getType());

    const sortSelect = new SortDroplist({
      collection: this.sortOptions,
      stateOptions: { selected: this.getSortOption(this.getState().getSort()) },
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
          this.getState().set({ teamId: id, clinicianId: null });
        } else {
          this.getState().set({ clinicianId: id, teamId: null });
        }
      },
    });

    this.getView().showChildView('title', listTitleView);
  },
  showNoOwnerToggleView() {
    const currentClinician = Radio.request('bootstrap', 'currentUser');
    if (this.getState().id !== 'shared-by' || !currentClinician.can('app:worklist:clinician_filter')) return;

    const ownerToggleView = new NoOwnerToggleView({
      model: this.getState(),
    });

    this.listenTo(ownerToggleView, 'click', () => {
      this.getState().set('noOwner', !this.getState().get('noOwner'));
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
    const searchView = new SearchView({
      query: this.getState().get('searchQuery'),
    });

    this.listenTo(searchView, 'change:query', searchQuery => {
      this.getState().setSearchQuery(searchQuery);
    });

    this.getView().showChildView('search', searchView);
  },
});

extend(WorklistApp.prototype, ListPageAppMixin);

export default WorklistApp;
