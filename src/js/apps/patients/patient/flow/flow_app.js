import { extend, get } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import intl, { renderTemplate } from 'js/i18n';
import { addError } from 'js/datadog';

import App from 'js/base/app';

import { ACTION_INCLUDE } from 'js/entities-service/actions';

import StateModel from './flow_state';

import BulkEditActionsApp from 'js/apps/patients/shared/bulk-edit/bulk-edit-actions_app';
import ActivityApp from 'js/apps/patients/patient/flow/flow-activity_app';

import { FlowLoadingView, LayoutView, HeaderView, ListView, MenuView, ProgressView, SelectAllView, i18n } from 'js/apps/patients/patient/flow/flow_views';
import { BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';
import { AddButtonView } from 'js/apps/patients/shared/add-workflow/add-workflow_views';

export default App.extend({
  routerAppName: 'FlowApp',
  childApps: {
    activity: ActivityApp,
  },
  createState() {
    return new StateModel();
  },
  stateEvents: {
    'change:actionsSelected': 'onChangeSelected',
  },
  onChangeSelected() {
    this.toggleBulkSelect();
  },
  onBeforeStart() {
    this.getState().clearSelected();

    this.showView(new FlowLoadingView());
  },
  prepareStart({ flowId }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:flows:model', flowId, { signal }),
      Radio.request('entities', 'fetch:actions:collection:byFlow', flowId, { signal }),
    ]);
  },
  handleStartFailure(options, error) {
    return this.showLoadFailure(options, error);
  },
  showLoadFailure(options, error) {
    if (get(error, ['response', 'status']) === 410) {
      Radio.request('alert', 'show:error', i18n.notFound);
      Radio.trigger('event-router', 'patient:workflow', options.patient.id);
      return;
    }

    throw error;
  },
  onStart(app, { patient }, [flow, actions]) {
    this.flow = flow;
    this.actions = actions;
    this.editableCollection = actions.clone();
    this.patient = patient;

    this.addOpts = this.getAddOpts(this.flow.getProgramFlow());

    this.subscribe();

    this.setView(new LayoutView()).render();

    this.updateContext();

    this.listenTo(this.editableCollection, 'reset', this.toggleBulkSelect);
    this.toggleBulkSelect();

    this.showHeader();
    this.showMenu();
    this.showActionList();
    this.startActivity();

    this.listenTo(this.actions, {
      'add': this.onAddAction,
      'change:_state': this.onActionChangeState,
      'destroy': this.onActionDestroy,
    });

    this.listenTo(this.flow, {
      'change:name': this.updateContext,
      'change:_owner'(flowModel, owner) {
        this.onFlowChangeOwner(flowModel, owner);
        this.showMenu();
      },
    });

    this.showView();
  },
  onStop() {
    this.unsubscribe();
    if (this.editableCollection) this.stopListening(this.editableCollection);
    if (this.actions) this.stopListening(this.actions);
    if (this.flow) this.stopListening(this.flow);
  },
  updateContext() {
    this.trigger('context:change', {
      page: 'flow',
      flowId: this.flow.id,
      flowName: this.flow.get('name'),
    });
  },
  subscribe() {
    const filters = { actions: { flow: this.flow.id } };
    Radio.request('ws', 'subscribe', this.getSubscriptionResources(), { filters });
    Radio.request('ws', 'manage:add', this, this.actions, 'patient-actions', { include: ACTION_INCLUDE });
  },
  getSubscriptionResources() {
    return [this.flow, ...(this.actions?.models || [])].filter(Boolean);
  },
  unsubscribe() {
    Radio.request('ws', 'unsubscribe', this.getSubscriptionResources());
  },
  _setFlowProgress() {
    const complete = this.actions.filter(action => action.isDone()).length;
    const total = this.actions.length;

    this.flow.set({ _progress: { complete, total } });
  },
  onAddAction(action) {
    this.editableCollection.add(action);

    this._setFlowProgress();
  },
  onActionChangeState() {
    this._setFlowProgress();
  },
  onActionDestroy() {
    this._setFlowProgress();
  },
  onFlowChangeOwner(flow, _owner) {
    if (_owner.type === 'teams') return;
    const ownerTeam = flow.getOwner().getTeam();
    this.actions.each(action => {
      if (!action.isDone() && action.getOwner() === ownerTeam) action.set({ _owner });
    });
  },
  showHeader() {
    this.getView().showChildView('header', new HeaderView({ model: this.flow }));
    this.getView().showChildView('progress', new ProgressView({ model: this.flow }));
  },
  showMenu() {
    if (!this.flow.canDelete()) {
      this.getView().getRegion('menu').empty();
      return;
    }

    const menuView = new MenuView();

    this.listenTo(menuView, 'delete', this.onDelete);
    this.getView().showChildView('menu', menuView);
  },
  onDelete() {
    const modal = Radio.request('modal', 'show:small', extend({
      buttonClass: 'button button--danger',
      onSubmit: () => {
        this.flow.destroy({ wait: true })
          .then(() => {
            Radio.trigger('event-router', 'patient:workflow', this.patient.id);
          })
          .catch(({ responseData }) => {
            Radio.request('alert', 'show:apiError', responseData);
          });
        modal.destroy();
      },
    }, intl.patients.patient.flow.flowViews.deleteModal));
  },
  startActivity() {
    this.getChildApp('activity').start({
      region: this.getView().getRegion('activity'),
      flow: this.flow,
    }).catch(addError);
  },

  getAddOpts(programFlow) {
    return programFlow.getAddableActions().map(action => {
      return {
        text: action.get('name'),
        itemType: action.type,
        hasOutreach: action.hasOutreach(),
        customIcon: action.get('options'),
        programItem: action,
      };
    });
  },

  showAdd() {
    const addButtonView = new AddButtonView({
      headingText: i18n.addActionHeadingText,
      lists: [{ collection: new Backbone.Collection(this.addOpts) }],
    });

    this.listenTo(addButtonView, 'add:programAction', programItem => {
      this.triggerMethod('add:programAction', programItem);
    });

    this.getView().showChildView('tools', addButtonView);
  },

  toggleBulkSelect() {
    this.selected = this.getState().getSelected(this.editableCollection);
    this.getView().setEditing(!!this.selected.length);

    this.showSelectAll();

    if (this.selected.length) {
      this.showBulkEdit();
      return;
    }

    this.stopBulkEdit();
    this.showAdd();
  },
  onClickBulkCancel() {
    this.getState().clearSelected();
  },
  stopBulkEdit() {
    this.getChildApp('bulkEditActions')?.stop().catch(addError);
  },
  showBulkEdit() {
    if (!this.selected.length) return;

    const app = this.getChildApp('bulkEditActions') || this.addBulkEditApp();

    app.updateCollection(this.selected);
    app.start({
      collection: this.selected,
      region: this.getView().getRegion('tools'),
    }).catch(addError);
  },
  addBulkEditApp() {
    const app = this.addChildApp('bulkEditActions', new BulkEditActionsApp({
      stateOptions: { collection: this.selected },
    }));

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
            Radio.request('alert', 'show:error', i18n.bulkEditFailure);
            this.restart({
              flowId: this.flow.id,
              patient: this.patient,
            }).catch(error => {
              try {
                this.showLoadFailure({ patient: this.patient }, error);
              } catch(unhandledError) {
                addError(unhandledError);
              }
            });
          });
      },
    });
    return app;
  },
  showUpdateSuccess(itemCount) {
    Radio.request('alert', 'show:success', renderTemplate(BulkEditActionsSuccessTemplate, { itemCount }));
  },
  showDisabledSelectAll() {
    this.getView().showChildView('selectAll', new SelectAllView({ isDisabled: true }));
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

    this.getView().showChildView('selectAll', selectAllView);
  },
  onClickBulkSelect() {
    if (this.selected.length === this.editableCollection.length) {
      this.getState().clearSelected();
      return;
    }

    this.getState().selectMultiple(this.editableCollection.map('id'));
  },

  onAddProgramAction(programAction) {
    const action = programAction.createAction({ flow: this.flow });
    action.saveAll().then(() => {
      this.actions.add(action);
      Radio.request('ws', 'add', action);

      Radio.trigger('event-router', 'patient:flow:action', this.patient.id, this.flow.id, action.id);
    });
  },

  showActionList() {
    const listView = new ListView({
      collection: this.actions,
      editableCollection: this.editableCollection,
      state: this.getState(),
    });

    this.listenTo(listView, 'change:canEdit', () => {
      this.editableCollection.reset(this._getListEditable(listView));
    });

    this.getView().showChildView('actionList', listView);
    this.editableCollection.reset(this._getListEditable(listView));
  },

  _getListEditable(list) {
    if (this.flow.isDone()) return [];
    return list.children.reduce((models, { canEdit, model }) => {
      if (canEdit) models.push(model);
      return models;
    }, []);
  },

});
