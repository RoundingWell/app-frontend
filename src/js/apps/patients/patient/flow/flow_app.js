import { extend, get } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import intl, { renderTemplate } from 'js/i18n';
import handleErrors from 'js/utils/handle-errors';

import App from 'js/base/app';

import { ACTION_INCLUDE } from 'js/entities-service/actions';

import StateModel from './flow_state';

import BulkEditActionsApp from 'js/apps/patients/sidebar/bulk-edit/bulk-edit-actions_app';
import ActivityApp from 'js/apps/patients/patient/flow/flow-activity_app';

import { LayoutView, HeaderView, ListView, MenuView, SelectAllView, i18n } from 'js/apps/patients/patient/flow/flow_views';
import { BulkEditButtonView, BulkEditActionsSuccessTemplate } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';
import { AddButtonView } from 'js/apps/patients/shared/add-workflow/add-workflow_views';

export default App.extend({
  StateModel,
  routerAppName: 'FlowApp',
  childApps: {
    activity: ActivityApp,
    bulkEditActions: BulkEditActionsApp,
  },
  stateEvents: {
    'change:actionsSelected': 'onChangeSelected',
  },
  onChangeSelected() {
    this.toggleBulkSelect();
  },
  onBeforeStart() {
    this.resetStateDefaults();

    this.getRegion().startPreloader();
  },
  beforeStart({ flowId }) {
    return [
      Radio.request('entities', 'fetch:flows:model', flowId),
      Radio.request('entities', 'fetch:actions:collection:byFlow', flowId),
    ];
  },
  /* istanbul ignore next: error handling */
  onFail(options, error) {
    if (get(error, ['response', 'status']) === 410) {
      Radio.trigger('event-router', 'notFound');
      this.stop();
      return;
    }

    handleErrors(error);
  },
  onStart({ patient }, flow, actions) {
    this.flow = flow;
    this.actions = actions;
    this.editableCollection = actions.clone();
    this.patient = patient;

    this.addOpts = this.getAddOpts(this.flow.getProgramFlow());

    this.subscribe();

    this.showView(new LayoutView());

    this.trigger('context:change', {
      page: 'flow',
      flowId: this.flow.id,
      flowName: this.flow.get('name'),
    });

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

    this.listenTo(this.flow, 'change:_owner', function(flowModel, owner) {
      this.onFlowChangeOwner(flowModel, owner);
      this.showMenu();
    });
  },
  subscribe() {
    const filters = { actions: { flow: this.flow.id } };
    Radio.request('ws', 'subscribe', [this.flow, ...this.actions.models], { filters });
    Radio.request('ws', 'manage:add', this, this.actions, 'patient-actions', { include: ACTION_INCLUDE });
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
    this.showChildView('header', new HeaderView({ model: this.flow }));
  },
  showMenu() {
    if (!this.flow.canDelete()) {
      this.getRegion('menu').empty();
      return;
    }

    const menuView = new MenuView();

    this.listenTo(menuView, 'delete', this.onDelete);
    this.showChildView('menu', menuView);
  },
  onDelete() {
    const modal = Radio.request('modal', 'show:small', extend({
      buttonClass: 'button--red',
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
    this.startChildApp('activity', {
      region: this.getRegion('activity'),
      flow: this.flow,
    });
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

    this.showChildView('tools', addButtonView);
  },

  toggleBulkSelect() {
    this.selected = this.getState().getSelected(this.editableCollection);

    this.showSelectAll();

    if (this.selected.length) {
      this.showBulkEditButtonView();
      return;
    }

    this.showAdd();
  },
  showBulkEditButtonView() {
    const bulkEditButtonView = new BulkEditButtonView({
      tagName: 'span',
      collection: this.selected,
    });

    this.listenTo(bulkEditButtonView, {
      'click:cancel': this.onClickBulkCancel,
      'click:edit': this.onClickBulkEdit,
    });

    this.showChildView('tools', bulkEditButtonView);
  },
  onClickBulkCancel() {
    this.getState().clearSelected();
  },
  onClickBulkEdit() {
    const app = this.startChildApp('bulkEditActions', {
      state: { collection: this.selected },
    });

    this.listenTo(app, {
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
            Radio.request('alert', 'show:error', i18n.bulkEditFailure);
            this.getState().clearSelected();
            this.restart({
              flowId: this.flow.id,
              patient: this.patient,
            });
          });
      },
    });
  },
  showUpdateSuccess(itemCount) {
    Radio.request('alert', 'show:success', renderTemplate(BulkEditActionsSuccessTemplate, { itemCount }));
  },
  showDisabledSelectAll() {
    this.showChildView('selectAll', new SelectAllView({ isDisabled: true }));
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

    this.showChildView('selectAll', selectAllView);
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

    this.showChildView('actionList', listView);
  },

  _getListEditable(list) {
    if (this.flow.isDone()) return [];
    return list.children.reduce((models, { canEdit, model }) => {
      if (canEdit) models.push(model);
      return models;
    }, []);
  },

});
