import { extend, get } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import intl, { renderTemplate } from 'js/i18n';

import StateModel from './schedule_state';
import FiltersStateModel from 'js/apps/patients/shared/filters_state';

import BulkEditActionsApp from 'js/apps/patients/sidebar/bulk-edit/bulk-edit-actions_app';
import { ListFiltersPanelApp } from 'js/apps/patients/shared/list-filters/list-filters_app';
import ListPatientSidebarApp from 'js/apps/patients/shared/list-patient-sidebar_app';

import DateFilterComponent from 'js/apps/patients/shared/components/date-filter';
import SearchComponent from 'js/components/list-search';

import { CountView } from 'js/apps/patients/shared/list_views';
import { ListPageAppMixin } from 'js/apps/patients/shared/list-page';

import { LayoutView, ScheduleTitleView, SelectAllView, ScheduleListView, AllFiltersButtonView } from 'js/apps/patients/schedule/schedule_views';
import { BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

const FiltersApp = App.extend({
  StateModel: FiltersStateModel,
});

const ScheduleApp = App.extend({
  StateModel,
  childApps: {
    filters: {
      AppClass: FiltersApp,
      restartWithParent: false,
    },
    bulkEditActions: BulkEditActionsApp,
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
    'change:clinicianId change:dateFilters change:customFilters change:states change:flowStates': 'restart',
    'change:actionsSelected': 'onChangeSelected',
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
  onChangeSelected() {
    this.toggleBulkSelect();
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
    this.setState({ id: `schedule_${ currentUser.id }` });

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
  onBeforeStart() {
    if (this.isRestarting()) {
      const filtersApp = this.getChildApp('filters');

      filtersApp.setState(this.getState().getFiltersState());

      this.getSelectionBarRegion('count').empty();

      this.showFiltersButtonView();
      this.getRegion('list').startPreloader({ variant: 'generic' });

      return;
    }

    this.initListState();

    const layoutView = new LayoutView({ model: this.getState() });

    this.setListPageView(layoutView);

    this.showDisabledSelectAll();
    this.showSearchView();
    this.showScheduleTitle();
    this.showDateFilter();
    this.showFiltersButtonView();
    this.mountFiltersSidebar();

    this.getRegion('list').startPreloader({ variant: 'generic' });

    this.showView();
  },
  beforeStart() {
    if (this.isPatientSidebarOpen) this.listenToPatientSidebar();

    const filter = this.getState().getEntityFilter();
    const fields = { flows: ['name', 'state'], patients: ['first_name', 'last_name'] };
    const include = 'patient,flow';
    return Radio.request('entities', 'fetch:actions:collection', { data: { filter, fields, include } });
  },
  onStart(options, collection) {
    this.setWorklist(collection.getMeta('worklist'));

    this.collection = collection;
    this.filteredCollection = collection.clone();
    this.editableCollection = collection.clone();

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
      editableCollection: this.editableCollection,
      selectedPatientId: this.patientSidebarPatientId,
      state: this.getState(),
    });

    this.listenTo(scheduleListView, {
      'filtered'(filtered) {
        this.filteredCollection.reset(filtered);
        this.editableCollection.reset(this._getListEditable(scheduleListView));
      },
      'change:canEdit'() {
        this.editableCollection.reset(this._getListEditable(scheduleListView));
      },
      'click:patient': this.showPatientSidebar,
    });

    this.showChildView('list', scheduleListView);
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
      layoutState: this.layoutView.getLayoutState(),
      model: this.getFiltersState(),
    });

    this.listenTo(filtersButtonView, 'click', this.onClickFiltersButton);

    this.showChildView('filters', filtersButtonView);
  },
  mountFiltersSidebar() {
    const filtersState = this.getFiltersState();

    this.startChildApp('filtersSidebar', {
      region: this.getRegion('filtersSidebar'),
      filtersState,
      collapsedState: this.getState(),
      isDrawer: this.layoutView.isFiltersDrawer(),
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
    this.restoreFiltersSidebarLayout();
  },
  toggleBulkSelect() {
    this.selected = this.getState().getSelected(this.editableCollection);
    this.showSelectAll();

    if (this.selected.length) {
      this.showBulkEdit();
      return;
    }

    this.stopChildApp('bulkEditActions');
  },
  onClickBulkCancel() {
    this.getState().clearSelected();
  },
  showBulkEdit() {
    const app = this.getChildApp('bulkEditActions');

    if (app.isRunning()) {
      app.updateCollection(this.selected);
      return;
    }

    this.startChildApp('bulkEditActions', {
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
            Radio.request('alert', 'show:success', renderTemplate(BulkEditActionsSuccessTemplate, { itemCount }));
            app.stop();

            if (saveData.due_date && this.selected.some(action => action.changed.due_date)) {
              this.getState().clearSelected();
              this.restart();
              return;
            }

            this.getState().clearSelected();
          })
          .catch(() => {
            Radio.request('alert', 'show:error', intl.patients.schedule.scheduleApp.bulkEditFailure);
            this.getState().clearSelected();
            this.restart();
          });
      },
    });
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

    const dateFilterComponent = new DateFilterComponent({
      dateTypes,
      state: this.getState().getDateFilters(),
    });

    this.listenTo(dateFilterComponent.getState(), 'change', ({ attributes }) => {
      this.getState().setDateFilters(attributes);
    });

    this.showChildView('dateFilter', dateFilterComponent);
  },
  showScheduleTitle() {
    const scheduleTitleView = new ScheduleTitleView({ model: this.getState() });

    this.listenTo(scheduleTitleView, 'change:owner', ({ id }) => {
      this.setState({ clinicianId: id });
    });

    this.showChildView('title', scheduleTitleView);
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

extend(ScheduleApp.prototype, ListPageAppMixin);

export default ScheduleApp;
