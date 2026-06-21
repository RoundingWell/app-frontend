import { debounce } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/progress-bar.scss';
import 'scss/modules/table-list.scss';

import intl from 'js/i18n';
import PreloadRegion from 'js/regions/preload_region';

import { CheckComponent, StateComponent, OwnerComponent, DueComponent, TimeComponent, FormButton, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import { FlowStateComponent, OwnerComponent as FlowOwnerComponent } from 'js/apps/patients/shared/flows_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateView, ReadOnlyDueTimeView } from 'js/apps/patients/shared/read-only_views';

import HeaderTemplate from './header.hbs';
import ActionItemTemplate from './action-item.hbs';

import 'scss/domain/action-icons.scss';
import '../patient.scss';
import './patient-flow.scss';

export const i18n = intl.patients.patient.flowViews;

const ContextTrailView = View.extend({
  initialize() {
    this.patient = this.model.getPatient();
  },
  className: 'patient-flow__context-trail',
  template: hbs`
    {{#if hasLatestList}}
      <a class="js-back patient-flow__context-link">
        {{fas "chevron-left"}}{{ @intl.patients.patient.flowViews.contextBackBtn }}
      </a>
      {{fas "chevron-right"}}
    {{/if}}
    <a class="js-patient patient-flow__context-link">{{ firstName }} {{ lastName }}</a>{{fas "chevron-right"}}{{ name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
    'click .js-patient': 'click:patient',
  },
  onClickBack() {
    Radio.request('history', 'go:latestList');
  },
  onClickPatient() {
    Radio.trigger('event-router', 'patient:dashboard', this.patient.id);
  },
  templateContext() {
    return {
      hasLatestList: Radio.request('history', 'has:latestList'),
      firstName: this.patient.get('first_name'),
      lastName: this.patient.get('last_name'),
    };
  },
});

const HeaderView = View.extend({
  className: 'patient-flow__header',
  modelEvents: {
    'editing': 'onEditing',
    'change': 'render',
    'change:_progress': 'onChangeFlowProgress',
  },
  onEditing(isEditing) {
    this.$el.toggleClass('is-selected', isEditing);
  },
  template: HeaderTemplate,
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
  },
  triggers: {
    'click': 'edit',
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

const EmptyView = View.extend({
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.patients.patient.flowViews.emptyView }}</h2>`,
});

const ActionItemView = View.extend({
  className: 'table-list__item',
  modelEvents: {
    'change': 'render',
    'editing': 'onEditing',
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
    Radio.trigger('event-router', 'flow:action', this.model.getFlow().id, this.model.id);
  },
  onEditing(isEditing) {
    this.isEditing = isEditing;

    const isSelected = this.state.isSelected(this.model);

    if (isSelected) return;

    this.$el.toggleClass('is-selected', isEditing);
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
    if (this.isEditing) return;

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
      <div data-context-trail-region></div>
      <div class="patient-flow__header-container" data-header-region></div>
      <div class="patient-flow__actions">
        <div data-select-all-region></div>
        <div data-tools-region></div>
      </div>
      <div class="table-list patient-flow__table-list">
        <div class="table-list__header list-page__list-header"></div>
        <div class="table-list__list list-page__list" data-action-list-region></div>
      </div>
    </div>
    <div class="patient-flow__sidebar" data-sidebar-region></div>
  `,
  regions: {
    contextTrail: {
      el: '[data-context-trail-region]',
      replaceElement: true,
    },
    header: '[data-header-region]',
    sidebar: '[data-sidebar-region]',
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
  ContextTrailView,
  HeaderView,
  ListView,
  SelectAllView,
};
