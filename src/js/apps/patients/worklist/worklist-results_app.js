import { get } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import intl, { renderTemplate } from 'js/i18n';

import App from 'js/base/app';

import ListSelection from 'js/apps/patients/shared/list-selection';
import BulkEditActionsApp from 'js/apps/patients/shared/bulk-edit/bulk-edit-actions_app';
import BulkEditFlowsApp from 'js/apps/patients/shared/bulk-edit/bulk-edit-flows_app';
import { getSortOptions } from './worklist_sort';

import ResultsView from 'js/apps/patients/shared/list-results_views';

import { CountLoadingView, ListErrorView, ListLoadingView, ListUpdatingView, ListView, SelectAllView } from './worklist_views';
import { BulkEditFlowsSuccessTemplate, BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

export default App.extend({
  viewEvents: {
    'before:destroy': 'onBeforeDestroyView',
    'click:select-all': 'onSelectAll',
    'filtered': 'onFilter',
    'change:canEdit': 'onChangeCanEdit',
    'click:patient': 'selectPatient',
    'retry': 'refreshList',
  },
  onBeforeStart(app, { filtersState } = {}) {
    if (!this.getView()) this.showResults(filtersState);

    this.stopBulkEdit();
    this.showListUpdating();
  },
  prepareStart(options, { signal }) {
    return this.loadResults({ signal });
  },
  onStart(app, options, collection) {
    this.showCollection(collection);
  },
  showResults(filtersState) {
    this.filtersState = filtersState;
    this.run = {};
    const view = this.setView(new ResultsView({ SelectAllView }));
    this.selection = new ListSelection({ state: this.getState() });
    this.listenTo(this.selection, 'filter', (collection, filteredCollection) => {
      view.showCount({ collection, filteredCollection, isFlowList: this.getState().getType() === 'flows' });
    });
    this.listenTo(this.selection, 'change', selected => {
      view.showSelectAll(this.selection.getControlState());
      if (selected.length) this.showBulkEdit();
      else this.stopBulkEdit();
    });
    view.showSelectAll(this.selection.getControlState());
    this.showView();
  },
  onBeforeDestroyView() {
    this.releaseRun();
    this.stop();
  },
  onSelectAll() {
    this.selection.toggleAll();
  },
  onFilter(models) {
    this.selection.filter(models);
  },
  onChangeCanEdit() {
    this.selection.updateEditableCollection();
  },
  selectPatient(patient, triggerView) {
    this.patientSidebarTrigger = triggerView;
    this.triggerMethod('click:patient', patient);
  },
  onStop() {
    this.collection = null;
    this.patientSidebarPatientId = null;
  },
  releaseRun() {
    this.run = null;
    this.patientSidebarTrigger = null;
    this.releaseManagedAdds?.();
    this.releaseManagedAdds = null;
    this.stopListening(this.selection);
    this.selection.destroy();
    this.selection = null;
  },
  async loadResults({ signal }) {
    try {
      return await this.loadCollection({ signal });
    } catch(error) {
      signal.throwIfAborted();
      if (get(error, ['response', 'status']) !== 400) throw error;

      // A retry is part of this request, even when the defaults did not change.
      this.filtersState.set(this.filtersState.defaults(), { source: this });
      return this.loadCollection({ signal });
    }
  },
  refreshList() {
    return this.restart().catch(error => {
      this.handleRefreshError(error);
      return false;
    });
  },
  showCollection({ collection, query, filters, sortOptions, isFlowType }) {
    this.query = query;
    this.filters = filters;
    this.sortOptions = sortOptions;
    this.isFlowType = isFlowType;
    this.isRefreshingList = false;
    this.getView().getRegion('status').empty();
    this.collection = collection;
    this.getState().setWorklist(collection.getMeta('worklist'));
    this.filtersState.set('worklist', collection.getMeta('worklist'));
    this.subscribe();
    this.selection.setCollection(collection, { isFlowList: isFlowType });
    const view = new ListView({
      collection,
      editableCollection: this.selection.editableCollection,
      selectedPatientId: this.patientSidebarPatientId,
      state: this.getState(),
      viewComparator: this.getComparator(),
    });
    this.getView().showChildView('list', view);
  },
  focusPatientTrigger() {
    const triggerView = this.patientSidebarTrigger;
    this.patientSidebarTrigger = null;
    if (triggerView && !triggerView.isDestroyed()) triggerView.focusPatient();
  },
  setPatientSelected(patientId) {
    this.patientSidebarPatientId = patientId;
    this.getView()?.getChildView('list')?.setPatientSelected?.(patientId);
  },
  onClickBulkCancel() {
    this.getState().clearSelected();
  },
  getSelectionContext() {
    const type = this.getState().getType();
    return { run: this.run, type, selection: this.getState().get(`${ type }Selected`) };
  },
  isCurrentRun({ run, type }) {
    return !!run && this.run === run && this.getState().getType() === type;
  },
  isCurrentSelection(context) {
    return this.isCurrentRun(context)
      && this.getState().get(`${ context.type }Selected`) === context.selection;
  },
  stopBulkEdit() {
    this.getChildApp('bulkEditActions')?.stop();
    this.getChildApp('bulkEditFlows')?.stop();
  },
  stateEvents: {
    'change:actionsSortId': 'onChangeStateSort',
    'change:flowsSortId': 'onChangeStateSort',
  },
  handleRefreshError(error) {
    const listView = this.getView()?.getChildView('list');
    if (this.isRefreshingList && listView?.setLoading) {
      listView.setLoading(false);
      this.getView().getRegion('count').empty();
    }

    this.showListError(this.isRefreshingList);
    this.isRefreshingList = false;
  },
  showBulkEdit() {
    const appName = this.getState().isFlowType() ? 'bulkEditFlows' : 'bulkEditActions';
    const AppClass = this.getState().isFlowType() ? BulkEditFlowsApp : BulkEditActionsApp;
    const currentApp = this.getChildApp(appName);

    const app = currentApp || this.addChildApp(appName, new AppClass({
      stateOptions: { collection: this.selection.selected },
    }));

    if (!currentApp) {
      this.listenTo(app, {
        'cancel': this.onClickBulkCancel,
        'applyOwner'(owner) {
          this.selection.selected.applyOwner(owner);
        },
        'save'(saveData, save) {
          const saveContext = this.getSelectionContext();
          const selected = this.selection.selected;
          const isFlowType = this.getState().isFlowType();
          const itemCount = selected.length;

          selected.save(saveData)
            .then(() => {
              if (!this.isCurrentRun(saveContext)) return;
              const savedCurrentEditor = app.resetChanges(save);
              if (this.isCurrentSelection(saveContext)) this.showUpdateSuccess(itemCount, isFlowType);
              if (savedCurrentEditor && this.isCurrentSelection(saveContext)) this.getState().clearSelected();
            })
            .catch(() => {
              if (!this.isCurrentRun(saveContext)) return;
              const savedCurrentEditor = app.resetChanges(save);
              if (this.isCurrentSelection(saveContext)) {
                Radio.request('alert', 'show:error', intl.patients.worklist.worklistApp.bulkEditFailure);
              }
              if (savedCurrentEditor && this.isCurrentSelection(saveContext)) this.getState().clearSelected();
              this.refreshList();
            });
        },
      });
    }

    app.updateCollection(this.selection.selected);
    app.start({
      collection: this.selection.selected,
      region: this.getView().getRegion('bulkEdit'),
    }).catch(addError);
  },
  loadCollection({ signal }) {
    const isFlowType = this.getState().isFlowType();
    const entityRequest = isFlowType ? 'fetch:flows:collection' : 'fetch:actions:collection';
    const sortOptions = getSortOptions(this.getState().getType());

    const includes = ['patient', ...sortOptions.getInclude()];
    const fields = { patients: ['first_name', 'last_name', 'patient-fields', 'segment'] };
    const filters = this.getState().getEntityFilter();

    if (!isFlowType) {
      fields.flows = ['name', 'state'];
      includes.push('flow');
    }

    const query = {
      filter: filters,
      fields,
      include: includes.join(','),
    };

    return Radio.request('entities', entityRequest, { data: query, signal })
      .then(collection => ({ collection, query, filters, sortOptions, isFlowType }));
  },
  showUpdateSuccess(itemCount, isFlowType) {
    if (isFlowType) {
      Radio.request('alert', 'show:success', renderTemplate(BulkEditFlowsSuccessTemplate, { itemCount }));
      return;
    }

    Radio.request('alert', 'show:success', renderTemplate(BulkEditActionsSuccessTemplate, { itemCount }));
  },
  showListLoading() {
    const loadingView = new ListLoadingView({ isFlowList: this.getState().isFlowType() });

    this.getView().getRegion('count').show(new CountLoadingView());
    this.getView().showChildView('list', loadingView);
    this.getView().getRegion('status').empty();
  },
  showListUpdating() {
    const listView = this.getView()?.getChildView('list');

    if (!listView || !listView.setLoading) {
      this.isRefreshingList = false;
      this.showListLoading();
      return;
    }

    this.isRefreshingList = true;
    listView.setLoading(true);
    this.getView().getRegion('status').empty();
    this.getView().getRegion('count').show(new ListUpdatingView({ isFlowList: this.getState().isFlowType() }));
  },
  showListError(isRefresh) {
    const errorView = new ListErrorView({ isRefresh });

    if (isRefresh) {
      this.getView().getRegion('status').show(errorView);
      return;
    }

    this.getView().getRegion('status').empty();
    this.getView().showChildView('list', errorView);
  },
  subscribe() {
    const isFlowType = this.isFlowType;
    const entityType = isFlowType ? 'flows' : 'patient-actions';
    const filterType = isFlowType ? 'flows' : 'actions';

    this.releaseManagedAdds?.();
    Radio.request('ws', 'subscribe', this.collection.models, { filters: { [filterType]: this.filters } });
    this.releaseManagedAdds = Radio.request('ws', 'manage:add', this, this.collection, entityType, this.query);
  },
  getSortOption(sortId) {
    const options = getSortOptions(this.getState().getType());
    const opt = options.get(sortId);

    if (!opt) {
      const stateDefaults = this.getState().defaults();
      const defaultSortId = stateDefaults[`${ this.getState().getType() }SortId`];

      return options.get(defaultSortId);
    }

    return opt;
  },
  getComparator() {
    const sortId = this.getState().getSort();
    return this.getSortOption(sortId).getComparator();
  },
  onChangeStateSort() {
    const listView = this.getView().getChildView('list');
    listView.setComparator(this.getComparator());
  },
});
