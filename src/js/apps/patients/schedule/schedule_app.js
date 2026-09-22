import { extend, get } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import intl, { renderTemplate } from 'js/i18n';

import StateModel from './schedule_state';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';

import BulkEditActionsApp from 'js/apps/patients/shared/bulk-edit/bulk-edit-actions_app';
import { ListFiltersPanelApp } from 'js/apps/patients/shared/list-filters/list-filters_app';
import ListPatientSidebarApp from 'js/apps/patients/shared/list-patient-sidebar_app';

import DateFilter from 'js/apps/patients/shared/components/date-filter';
import SearchView from 'js/components/list-search';

import { CountView } from 'js/apps/patients/shared/list_views';
import { ListPageAppMixin } from 'js/apps/patients/shared/list-page';

import { LayoutView, ScheduleTitleView, SelectAllView, ScheduleListView, AllFiltersButtonView } from 'js/apps/patients/schedule/schedule_views';
import { BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

const FiltersApp = App.extend({
  createState({ stateOptions }) {
    return new FiltersStateModel(stateOptions);
  },
});

const ScheduleApp = App.extend({
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
    'change:clinicianId': 'refreshList',
    'change:dateFilters': 'refreshList',
    'change:customFilters': 'refreshList',
    'change:states': 'refreshList',
    'change:flowStates': 'refreshList',
    'change:actionsSelected': 'onChangeSelected',
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
  onChangeSelected() {
    this.toggleBulkSelect();
  },
  onChangeSearchQuery(state) {
    this.currentSearchQuery = state.get('searchQuery');
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
    this.initFiltersApp({ setDefaults: !storedState });
  },
  onStop() {
    this.stopListening(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this._canRefresh = false;
    this._bulkEditSuspended = false;
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
  onBeforeStart() {
    this.stopListening(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this.listenTo(Radio.channel('event-router'), 'unknownError', this.onUnknownError);
    this._canRefresh = false;
    this._bulkEditSuspended = false;
    this.initListState();

    const layoutView = new LayoutView({ model: this.getState() });

    this.setListPageView(layoutView).render();

    this.showDisabledSelectAll();
    this.showSearchView();
    this.showFiltersButtonView();

    this.getView().getRegion('list').startPreloader({ variant: 'generic' });
    this.showView();
  },
  prepareStart(options, { signal }) {
    if (this.isPatientSidebarOpen) this.listenToPatientSidebar();

    return this.getChildApp('filters').start()
      .then(() => this.loadCollection({ signal }))
      .catch(error => {
        if (get(error, ['response', 'status']) !== 400) throw error;

        this.filterState.setDefaultFilterStates();
        return this.loadCollection({ signal });
      });
  },
  loadCollection({ signal } = {}) {
    const filter = this.getState().getEntityFilter();
    const fields = { flows: ['name', 'state'], patients: ['first_name', 'last_name'] };
    const include = 'patient,flow';
    return Radio.request('entities', 'fetch:actions:collection', {
      data: { filter, fields, include },
      signal,
    });
  },
  onStart(app, options, collection) {
    this.showCollection(collection);
    this.mountFiltersSidebar().catch(addError);
    this.showScheduleTitle();
    this.showDateFilter();
    this.showView();
    this._canRefresh = true;
  },
  showCollection(collection) {
    this.setWorklist(collection.getMeta('worklist'));

    if (this.filteredCollection) this.stopListening(this.filteredCollection);
    if (this.editableCollection) this.stopListening(this.editableCollection);
    this.collection = collection;
    this.filteredCollection = collection.clone();
    this.editableCollection = collection.clone();

    this.listenTo(this.filteredCollection, 'reset', this.showCountView);
    this.showCountView();

    this.listenTo(this.editableCollection, 'reset', this.toggleBulkSelect);
    this.toggleBulkSelect();

    this.showList();
  },
  async refreshList() {
    if (!this._canRefresh) return;

    if (!this.suspendBulkEditForRefresh()) return;

    this.filterState.set(this.getState().getFiltersState());
    this._refreshController?.abort();
    const controller = new AbortController();
    this._refreshController = controller;
    this.stopListeningToList();
    if (this.editableCollection) this.stopListening(this.editableCollection);
    this.editableCollection = null;
    this.showDisabledSelectAll();
    this.getSelectionBarRegion('count').empty();
    this.getView().getRegion('list').startPreloader({ variant: 'generic' });

    try {
      const collection = await this.loadCollection({ signal: controller.signal });
      if (!this.isCurrentRefresh(controller)) return;

      this.showCollection(collection);
    } catch(error) {
      if (this.isCurrentRefresh(controller)) this.handleRefreshError(error);
    } finally {
      this.finishRefresh(controller);
    }
  },
  finishRefresh(controller) {
    if (this._refreshController === controller) this._refreshController = null;
  },
  stopListeningToList() {
    const listView = this.getView()?.getChildView('list');
    if (listView) this.stopListening(listView);
  },
  suspendBulkEditForRefresh() {
    this._bulkEditSuspended = true;
    this.getState().clearSelected();

    const app = this.getChildApp('bulkEditActions');
    if (app) {
      app.resetChanges();
      const view = app.getView();
      if (view) view.el.hidden = true;
    }

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

    if (this.collection) this.showCollection(this.collection);
    Radio.request('alert', 'show:error', intl.patients.schedule.scheduleApp.refreshFailure);
    addError(error);
  },
  setWorklist(worklist) {
    this.getState().setWorklist(worklist);
    const filtersState = this.getFiltersState();
    filtersState.set('worklist', worklist);
  },
  showList() {
    const scheduleListView = new ScheduleListView({
      collection: this.collection.groupByDate(),
      editableCollection: this.editableCollection,
      selectedPatientId: this.patientSidebarPatientId,
      state: this.getState(),
    });

    this.listenTo(scheduleListView, {
      'destroy'() {
        this.stopListening(scheduleListView);
      },
      'filtered'(filtered) {
        this.filteredCollection.reset(filtered);
        this.editableCollection.reset(this._getListEditable(scheduleListView));
      },
      'change:canEdit'() {
        this.editableCollection.reset(this._getListEditable(scheduleListView));
      },
      'click:patient': this.showPatientSidebar,
    });

    this.getView().showChildView('list', scheduleListView);
  },
  _getListEditable(list) {
    return list.children.reduce((allModels, dayView) => {
      return dayView.children.reduce((models, { canEdit, model }) => {
        if (canEdit) models.push(model);
        return models;
      }, allModels);
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

    return this.getChildApp('filtersSidebar').start({
      filtersState,
      layoutState: this.getView().getLayoutState(),
      isDrawer: this.getView().isFiltersDrawer(),
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
    const layoutView = this.getView();
    this._patientSidebarRequest = null;
    this.isPatientSidebarOpen = false;
    this.patientSidebarPatientId = null;
    this.getView().getChildView('list').setPatientSelected(null);
    await this.getChildApp('patientSidebar')?.stop();
    if (this.getView() !== layoutView) return false;
    if (!await this.mountFiltersSidebar() || this.getView() !== layoutView) return false;
    this.restoreFiltersSidebarLayout();
    return true;
  },
  toggleBulkSelect() {
    if (!this.editableCollection) return;

    this.selected = this.getState().getSelected(this.editableCollection);
    this.showSelectAll();

    if (this.selected.length) {
      this.showBulkEdit();
      return;
    }

    if (this._bulkEditSuspended) return;

    this.getChildApp('bulkEditActions')?.stop().catch(addError);
  },
  onClickBulkCancel() {
    this.getState().clearSelected();
  },
  showBulkEdit() {
    const currentApp = this.getChildApp('bulkEditActions');

    this._bulkEditSuspended = false;
    const currentView = currentApp?.getView();
    if (currentView) currentView.el.hidden = false;

    const app = currentApp || this.addChildApp('bulkEditActions', new BulkEditActionsApp({
      stateOptions: { collection: this.selected },
    }));

    if (!currentApp) {
      this.listenTo(app, {
        'cancel': this.onClickBulkCancel,
        'applyOwner'(owner) {
          this.selected.applyOwner(owner);
        },
        'save'(saveData) {
          const selected = this.selected;
          const itemCount = selected.length;
          const shouldRefresh = saveData.due_date && selected.some(action => {
            return action.get('due_date') !== saveData.due_date;
          });

          selected.save(saveData)
            .then(() => {
              app.resetChanges();
              Radio.request('alert', 'show:success', renderTemplate(BulkEditActionsSuccessTemplate, { itemCount }));

              if (shouldRefresh) {
                this.refreshList();
                return;
              }

              this.getState().clearSelected();
            })
            .catch(() => {
              app.resetChanges();
              Radio.request('alert', 'show:error', intl.patients.schedule.scheduleApp.bulkEditFailure);
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
  showDisabledSelectAll() {
    this.showSelectionBarChildView('selectAll', new SelectAllView({ isDisabled: true }));
  },
  showSelectAll() {
    if (!this.editableCollection.length) {
      this.showDisabledSelectAll();
      return;
    }

    const selectAllView = new SelectAllView({
      isSelectAll: this.selected.length === this.editableCollection.length,
      isSelectNone: !this.selected.length,
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
  showCountView() {
    const countView = new CountView({
      collection: this.collection,
      filteredCollection: this.filteredCollection,
    });

    this.showSelectionBarChildView('count', countView);
  },
  showDateFilter() {
    const dateTypes = ['due_date'];

    const dateFilter = new DateFilter({
      dateTypes,
      stateOptions: this.getState().getDateFilters(),
    });

    this.listenTo(dateFilter.getState(), 'change', ({ attributes }) => {
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

extend(ScheduleApp.prototype, ListPageAppMixin);

export default ScheduleApp;
