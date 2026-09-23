import { get, has } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import intl, { renderTemplate } from 'js/i18n';
import createLatestRequest from 'js/utils/latest-request';

import App from 'js/base/app';

import ListSelection from 'js/apps/patients/shared/list-selection';
import BulkEditActionsApp from 'js/apps/patients/shared/bulk-edit/bulk-edit-actions_app';

import ResultsView from 'js/apps/patients/shared/list-results_views';

import { SelectAllView, ScheduleListView, ListErrorView } from './schedule_views';
import { LoadingView } from 'js/regions/preload_region';
import { BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

export default App.extend({
  onBeforeStart(app, { filtersState }) {
    this.releaseRun();
    this.filtersState = filtersState;
    this.run = {};
    const run = this.run;
    const view = this.setView(new ResultsView({ SelectAllView }));
    this.listenTo(view, {
      'before:destroy': () => {
        if (this.run === run) this.releaseRun(view);
      },
      'click:select-all': () => this.selection.toggleAll(),
    });
    this.selection = new ListSelection({ state: this.getState() });
    this.listenTo(this.selection, 'filter', (collection, filteredCollection) => {
      view.showCount({ collection, filteredCollection, isFlowList: this.getState().getType() === 'flows' });
    });
    this.listenTo(this.selection, 'change', selected => {
      view.showSelectAll(this.selection.getControlState());
      if (selected.length) this.showBulkEdit();
      else this.stopBulkEdit().catch(addError);
    });
    this.requests = createLatestRequest({
      load: async(input, { signal }) => {
        await this.stopBulkEdit();
        signal.throwIfAborted();
        this.selection.releaseCollections();
        view.showSelectAll(this.selection.getControlState());
        this.getView().getRegion('count').empty();
        this.showListLoading();
        return this.loadResults({ signal });
      },
      commit: collection => this.showCollection(collection),
      fail: error => this.handleRefreshError(error),
    });
    view.showSelectAll(this.selection.getControlState());
    this.showListLoading();
    this.showView();
  },
  onStart() {
    this.refreshList().catch(addError);
  },
  onStop() {
    this.releaseRun();
    this.patientSidebarPatientId = null;
  },
  onBeforeDestroy() {
    this.releaseRun();
  },
  releaseRun(view = this.getView()) {
    this.requests?.dispose();
    if (view) {
      this.stopListening(view);
      const listView = view.getChildView('list');
      if (listView) this.stopListening(listView);
    }
    this.run = null;
    this.patientSidebarTrigger = null;
    if (this.selection) this.stopListening(this.selection);
    this.selection?.destroy();
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
    if (!this.isRunning() || !this.run) return Promise.resolve(false);

    return this.requests.run();
  },
  showCollection(collection) {
    this.getState().setWorklist(collection.getMeta('worklist'));
    this.filtersState.set('worklist', collection.getMeta('worklist'));
    this.selection.setCollection(collection);
    const view = new ScheduleListView({
      collection: collection.groupByDate(),
      editableCollection: this.selection.editableCollection,
      selectedPatientId: this.patientSidebarPatientId,
      state: this.getState(),
    });
    this.listenTo(view, {
      'destroy': () => this.stopListening(view),
      'filtered': models => this.selection.filter(models),
      'change:canEdit': () => this.selection.updateEditableCollection(),
      'click:patient': (patient, triggerView) => {
        this.patientSidebarTrigger = triggerView;
        this.triggerMethod('click:patient', patient);
      },
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
    return this.getChildApp('bulkEditActions')?.stop() || Promise.resolve();
  },
  showListLoading() {
    this.getView().showChildView('list', new LoadingView({ variant: 'generic' }));
  },
  handleRefreshError(error) {
    const view = new ListErrorView();
    this.listenTo(view, {
      'destroy': () => this.stopListening(view),
      'retry': this.refreshList,
    });
    this.getView().showChildView('list', view);
    addError(error);
  },
  showBulkEdit() {
    const currentApp = this.getChildApp('bulkEditActions');

    const app = currentApp || this.addChildApp('bulkEditActions', new BulkEditActionsApp({
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
          const itemCount = selected.length;
          const shouldRefresh = has(saveData, 'due_date') && selected.some(action => {
            return action.get('due_date') !== saveData.due_date;
          });

          selected.save(saveData)
            .then(() => {
              if (!this.isCurrentRun(saveContext)) return;
              const savedCurrentEditor = app.resetChanges(save);
              if (this.isCurrentSelection(saveContext)) {
                Radio.request('alert', 'show:success', renderTemplate(BulkEditActionsSuccessTemplate, { itemCount }));
              }

              if (savedCurrentEditor && this.isCurrentSelection(saveContext)) this.getState().clearSelected();
              if (shouldRefresh) this.refreshList();
            })
            .catch(() => {
              if (!this.isCurrentRun(saveContext)) return;
              const savedCurrentEditor = app.resetChanges(save);
              if (this.isCurrentSelection(saveContext)) {
                Radio.request('alert', 'show:error', intl.patients.schedule.scheduleApp.bulkEditFailure);
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
    const filter = this.getState().getEntityFilter();
    const fields = { flows: ['name', 'state'], patients: ['first_name', 'last_name'] };
    const include = 'patient,flow';
    return Radio.request('entities', 'fetch:actions:collection', {
      data: { filter, fields, include },
      signal,
    });
  },
});
