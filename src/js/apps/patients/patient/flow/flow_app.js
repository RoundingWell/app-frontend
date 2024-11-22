import { bind, invoke } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import intl, { renderTemplate } from 'js/i18n';

import SubRouterApp from 'js/base/subrouterapp';

import StateModel from './flow_state';

import BulkEditActionsApp from 'js/apps/patients/sidebar/bulk-edit-actions_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import FlowSiderbarApp from 'js/apps/patients/sidebar/flow-sidebar_app';
import ActionSiderbarApp from 'js/apps/patients/sidebar/action-sidebar_app';


import { LayoutView, ContextTrailView, HeaderView, ListView, SelectAllView } from 'js/views/patients/patient/flow/flow_views';
import { BulkEditButtonView, BulkEditActionsSuccessTemplate, BulkDeleteActionsSuccessTemplate } from 'js/views/patients/shared/bulk-edit/bulk-edit_views';
import { AddButtonView, i18n } from 'js/views/patients/shared/add-workflow/add-workflow_views';

export default SubRouterApp.extend({
  StateModel,
  routerAppName: 'FlowApp',
  childApps: {
    actionSidebar: ActionSiderbarApp,
    patient: PatientSidebarApp,
    bulkEditActions: BulkEditActionsApp,
    flowSidebar: FlowSiderbarApp,
  },
  eventRoutes: {
    'flow': 'hideSidebar',
    'flow:action': 'showActionSidebar',
    'flow:details': 'showFlowDetails',
  },
  stateEvents: {
    'change:actionsSelected': 'onChangeSelected',
  },
  onChangeSelected() {
    this.toggleBulkSelect();
  },
  onBeforeStart() {
    this.resetStateDefaults();
    this.showView(new LayoutView());
  },
  beforeStart({ flowId }) {
    return [
      Radio.request('entities', 'fetch:flows:model', flowId),
      Radio.request('entities', 'fetch:actions:collection:byFlow', flowId),
      Radio.request('entities', 'fetch:patients:model:byFlow', flowId),
    ];
  },
  onFail(options, { response = {} }) {
    /* istanbul ignore else: other error scenarios handled elsewhere */
    if (response.status === 410) {
      Radio.trigger('event-router', 'notFound');
      this.stop();
      return;
    }
    
    /* eslint-disable no-console */
    console.error(arguments);
  },
  onStart({ currentRoute }, flow, actions, patient) {
    this.flow = flow;
    this.actions = actions;
    this.editableCollection = actions.clone();
    this.patient = patient;
    this.addOpts = this.getAddOpts(this.flow.getProgramFlow());

    this.subscribe();

    this.showChildView('contextTrail', new ContextTrailView({
      model: this.flow,
    }));

    this.listenTo(this.editableCollection, 'reset', this.toggleBulkSelect);
    this.toggleBulkSelect();

    this.showHeader();
    this.showActionList();
    this.showSidebar();

    this.listenTo(this.actions, {
      'change:_state': this.onActionChangeState,
      'destroy': this.onActionDestroy,
    });

    this.listenTo(this.flow, {
      'change:_owner': this.onFlowChangeOwner,
      'message': this.onFlowMessage,
    });

    this.startRoute(currentRoute);
  },
  hideSidebar() {
    this.stopChildApp('flowSidebar');
    this.stopChildApp('actionSidebar');
  },
  subscribe() {
    Radio.request('ws', 'subscribe', invoke([this.flow, ...this.actions.models], 'getResource'));
  },
  _setFlowProgress() {
    const complete = this.actions.filter(action => action.isDone()).length;
    const total = this.actions.length;

    this.flow.set({ _progress: { complete, total } });
  },
  _addAction(action) {
    this.actions.add(action);
    this.editableCollection.add(action);

    this.subscribe();

    this._setFlowProgress();
  },
  onActionChangeState() {
    this._setFlowProgress();
  },
  onActionDestroy() {
    this._setFlowProgress();
  },
  onFlowMessage({ category, payload }) {
    if (category !== 'ResourceCreated') return;
    const { resource } = payload;

    const fetchAction = Radio.request('entities', 'fetch:actions:model', resource.id);
    fetchAction.then(bind(this._addAction, this));
  },
  onFlowChangeOwner(flow, _owner) {
    if (_owner.type === 'teams') return;
    const ownerTeam = flow.getOwner().getTeam();
    this.actions.each(action => {
      if (!action.isDone() && action.getOwner() === ownerTeam) action.set({ _owner });
    });
  },
  showHeader() {
    const headerView = new HeaderView({
      model: this.flow,
    });

    this.listenTo(headerView, {
      'edit': this.onEditFlow,
    });

    this.showChildView('header', headerView);
  },

  getAddOpts(programFlow) {
    return programFlow.getAddableActions().map(action => {
      return {
        text: action.get('name'),
        itemType: action.type,
        hasOutreach: action.hasOutreach(),
        onSelect: bind(this.triggerMethod, this, 'add:programAction', action),
      };
    });
  },

  showAdd() {
    this.showChildView('tools', new AddButtonView({
      headingText: i18n.addActionHeadingText,
      lists: [{ collection: new Backbone.Collection(this.addOpts) }],
    }));
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
      'delete'() {
        const itemCount = this.selected.length;

        this.selected.destroy().then(() => {
          this.showDeleteSuccess(itemCount);
          app.stop();
          this.getState().clearSelected();
        });
      },
    });
  },
  showDeleteSuccess(itemCount) {
    Radio.request('alert', 'show:success', renderTemplate(BulkDeleteActionsSuccessTemplate, { itemCount }));
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
    const action = programAction.getAction({ flowId: this.flow.id });
    action.saveAll().then(() => {
      this._addAction(action);

      Radio.trigger('event-router', 'flow:action', this.flow.id, action.id);
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

  showSidebar() {
    this.startChildApp('patient', {
      region: this.getRegion('sidebar'),
      patient: this.patient,
    });
  },

  showActionSidebar(flowId, actionId) {
    const sidebarApp = this.getChildApp('actionSidebar');

    sidebarApp.stop();

    const action = Radio.request('entities', 'actions:model', actionId);

    Radio.request('sidebar', 'start', sidebarApp, { action });

    this.listenTo(sidebarApp, 'close', () => {
      Radio.trigger('event-router', 'flow', flowId);
    });
  },

  onEditFlow() {
    Radio.trigger('event-router', 'flow:details', this.flow.id);
  },

  showFlowDetails() {
    const sidebarApp = this.getChildApp('flowSidebar');

    Radio.request('sidebar', 'start', sidebarApp, { flow: this.flow });

    this.listenTo(sidebarApp, 'close', () => {
      Radio.trigger('event-router', 'flow', this.flow.id);
    });
  },
});
