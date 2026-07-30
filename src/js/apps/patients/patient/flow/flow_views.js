import { debounce } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/progress-bar.scss';
import 'scss/modules/table-list.scss';

import intl from 'js/i18n';
import PreloadRegion from 'js/regions/preload_region';
import Optionlist from 'js/components/optionlist';

import { CheckComponent, StateComponent, OwnerComponent, DueComponent, TimeComponent, FormButton, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import { FlowStateComponent, OwnerComponent as FlowOwnerComponent } from 'js/apps/patients/shared/flows_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateView, ReadOnlyDueTimeView } from 'js/apps/patients/shared/read-only_views';

import HeaderTemplate from './header.hbs';
import ActionItemTemplate from './action-item.hbs';

import 'scss/domain/action-icons.scss';
import '../patient.scss';
import './patient-flow.scss';

export const i18n = intl.patients.patient.flow.flowViews;

const HeaderView = View.extend({
  className: 'patient-flow__header',
  modelEvents: {
    'change': 'render',
    'change:_progress': 'onChangeFlowProgress',
  },
  template: HeaderTemplate,
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
  },
  ui: {
    progress: '.js-progress',
  },
  onRender() {
    this.canEdit = this.model.canEdit();

    this.showState();
    this.showOwner();
  },
  showState() {
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model, isCompact: true });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    const stateComponent = new FlowStateComponent({
      flow: this.model,
      stateId: this.model.getState().id,
      isCompact: true,
    });

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model, isCompact: true });
      this.showChildView('owner', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    const program = this.model.getProgram();
    const ownerComponent = new FlowOwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
      state: { isDisabled },
    });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  onChangeFlowProgress() {
    const prog = this.model.get('_progress');
    this.ui.progress.attr({ value: prog.complete, max: prog.total });
  },
});

const MenuView = View.extend({
  tagName: 'button',
  className: 'button--icon js-menu',
  attributes: {
    'aria-label': i18n.menu.headingText,
    'type': 'button',
  },
  template: hbs`{{far "ellipsis"}}`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    const optionlist = new Optionlist({
      ui: this.$el,
      uiView: this,
      headingText: i18n.menu.headingText,
      itemTemplate: hbs`{{far "trash-can" classes="sidebar__delete-icon"}}<span>{{ @intl.patients.patient.flow.flowViews.menu.delete }}</span>`,
      lists: [{ collection: new Backbone.Collection([{}]) }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', () => {
      this.triggerMethod('delete');
    });

    optionlist.show();
  },
});

const EmptyView = View.extend({
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.patients.patient.flow.flowViews.emptyView }}</h2>`,
});

const ActionItemView = View.extend({
  className: 'table-list__item',
  modelEvents: {
    'change': 'render',
  },
  initialize({ state }) {
    this.state = state;

    this.listenTo(state, {
      'select:multiple': this.showCheck,
      'select:none': this.showCheck,
    });

    this.flow = this.model.getFlow();

    this.listenTo(this.flow, {
      'change:_state': this.render,
    });
  },
  template: ActionItemTemplate,
  templateContext() {
    return {
      hasForm: this.model.getForm(),
      icon: this.model.hasOutreach() ? 'share-from-square' : 'file-lines',
      hasAttachments: this.model.hasAttachments(),
      commentCount: this.model.commentCount(),
    };
  },
  regions: {
    check: '[data-check-region]',
    details: '[data-details-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDate: '[data-due-date-region]',
    dueTime: '[data-due-time-region]',
    form: '[data-form-region]',
  },
  triggers: {
    'click': 'click',
    'click .js-no-click': 'prevent-row-click',
  },
  onClick() {
    Radio.trigger('event-router', 'patient:flow:action', this.model.getPatient().id, this.model.getFlow().id, this.model.id);
  },
  onRender() {
    const canEdit = this.canEdit;
    this.canEdit = !this.flow.isDone() && this.model.canEdit();

    this.showCheck();
    this.showDetailsTooltip();
    this.showState();
    this.showOwner();
    this.showDueDate();
    this.showDueTime();
    this.showForm();

    if (canEdit !== this.canEdit) {
      if (!this.canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
  },
  toggleSelected(isSelected) {
    this.$el.toggleClass('is-selected', isSelected);
  },
  showCheck() {
    if (!this.canEdit) return;

    const isSelected = this.state.isSelected(this.model);
    this.toggleSelected(isSelected);
    const checkComponent = new CheckComponent({ state: { isSelected } });

    this.listenTo(checkComponent, {
      'select'(domEvent) {
        this.triggerMethod('select', this, !!domEvent.shiftKey);
      },
      'change:isSelected': this.toggleSelected,
    });

    this.showChildView('check', checkComponent);
  },
  showDetailsTooltip() {
    if (!this.model.get('details')) return;

    this.showChildView('details', new DetailsTooltip({ model: this.model }));
  },
  showState() {
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model, isCompact: true });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    this.stateComponent = new StateComponent({ stateId: this.model.getState().id, isCompact: true });

    this.listenTo(this.stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', this.stateComponent);
  },
  showOwner() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model, isCompact: true });
      this.showChildView('owner', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    const program = this.model.getProgram();
    this.ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
      state: { isDisabled },
    });

    this.listenTo(this.ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', this.ownerComponent);
  },
  showDueDate() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueDateView({ model: this.model });
      this.showChildView('dueDate', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    this.dueDateComponent = new DueComponent({
      date: this.model.get('due_date'),
      isCompact: true,
      state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(this.dueDateComponent, 'change:due', date => {
      this.model.saveDueDate(date);
    });

    this.showChildView('dueDate', this.dueDateComponent);
  },
  showDueTime() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueTimeView({ model: this.model });
      this.showChildView('dueTime', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone() || !this.model.get('due_date');
    this.dueTimeComponent = new TimeComponent({
      time: this.model.get('due_time'),
      isCompact: true, state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(this.dueTimeComponent, 'change:time', time => {
      this.model.saveDueTime(time);
    });

    this.showChildView('dueTime', this.dueTimeComponent);
  },
  showForm() {
    if (!this.model.getForm()) return;

    this.showChildView('form', new FormButton({ model: this.model }));
  },
});

const ListView = CollectionView.extend({
  className: 'table-list__list list-page__list patient-flow__list',
  childView: ActionItemView,
  childViewOptions() {
    return {
      state: this.getOption('state'),
    };
  },
  childViewTriggers: {
    'select': 'select',
    'change:canEdit': 'listItem:canEdit',
  },
  emptyView: EmptyView,
  viewComparator({ model }) {
    return model.get('sequence');
  },
  initialize({ state, editableCollection }) {
    this.state = state;
    this.editableCollection = editableCollection;

    this.onListItemCanEdit = debounce(this.onListItemCanEdit, 60);
  },
  onListItemCanEdit() {
    // NOTE: debounced in initialize
    this.triggerMethod('change:canEdit');
  },
  onSelect(selectedView, isShiftKeyPressed) {
    this.state.selectRange(this.editableCollection, selectedView.model, isShiftKeyPressed);
  },
});

const LayoutView = View.extend({
  className: 'patient-flow__frame',
  template: hbs`
    <div class="patient-flow__layout">
      <div class="patient-flow__header-container">
        <div data-header-region></div>
        <div data-menu-region></div>
      </div>
      <div class="patient-flow__actions">
        <div data-select-all-region></div>
        <div data-tools-region></div>
      </div>
      <div class="table-list patient-flow__table-list">
        <div class="table-list__header list-page__list-header"></div>
        <div class="table-list__list list-page__list" data-action-list-region></div>
      </div>
      <div class="patient-flow__activity">
        <h3>{{ @intl.patients.patient.flow.flowViews.activityHeadingText }}</h3>
        <div data-activity-region></div>
      </div>
    </div>
  `,
  regions: {
    header: '[data-header-region]',
    menu: {
      el: '[data-menu-region]',
      replaceElement: true,
    },
    activity: {
      el: '[data-activity-region]',
      regionClass: PreloadRegion,
    },
    actionList: {
      el: '[data-action-list-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
    tools: {
      el: '[data-tools-region]',
      replaceElement: true,
    },
    selectAll: {
      el: '[data-select-all-region]',
      replaceElement: true,
    },
  },
});

const SelectAllView = View.extend({
  tagName: 'button',
  className: 'button--checkbox u-margin--r-16',
  attributes() {
    if (this.getOption('isDisabled')) return { disabled: 'disabled' };
  },
  triggers: {
    'click': 'click',
  },
  getTemplate() {
    if (this.getOption('isSelectAll')) return hbs`{{fas "square-check"}}`;
    if (this.getOption('isSelectNone') || this.getOption('isDisabled')) return hbs`{{fal "square"}}`;

    return hbs`{{fas "square-minus"}}`;
  },
});

export {
  LayoutView,
  HeaderView,
  ListView,
  MenuView,
  SelectAllView,
};
