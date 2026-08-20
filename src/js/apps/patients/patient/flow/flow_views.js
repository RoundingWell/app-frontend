import { debounce, extend } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/card-list.scss';
import 'scss/modules/loader.scss';
import 'scss/modules/progress-bar.scss';
import 'scss/modules/skeleton.scss';

import intl from 'js/i18n';
import stopEventPropagation from 'js/utils/stop-event-propagation';
import PreloadRegion from 'js/regions/preload_region';
import Optionlist from 'js/components/optionlist';

import { CheckComponent, StateComponent, OwnerComponent, DueComponent, TimeComponent, FormButton, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import SharedSelectAllView from 'js/apps/patients/shared/components/select-all_view';
import { FlowStateComponent, OwnerComponent as FlowOwnerComponent } from 'js/apps/patients/shared/flows_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateView, ReadOnlyDueTimeView } from 'js/apps/patients/shared/read-only_views';
import ActionItemTemplate from './action-item.hbs';
import HeaderTemplate from './header.hbs';
import LayoutTemplate from './layout.hbs';
import LoadingTemplate from './loading.hbs';

import 'scss/domain/work-card.scss';
import 'scss/domain/action-card.scss';
import 'scss/domain/flow-card.scss';
import 'scss/domain/patient-list.scss';
import '../patient.scss';
import './patient-flow.scss';

const FlowLoadingView = View.extend({
  className: 'loader patient__content patient__content--scroll patient-detail-page patient-flow__frame patient-flow__loader',
  attributes: {
    'aria-busy': 'true',
    'role': 'status',
  },
  template: LoadingTemplate,
  templateContext() {
    return { items: new Array(2).fill(null) };
  },
});

const FlowFormButton = FormButton.extend({
  className: 'button button--icon action-form-button patient-flow__action-form',
});

const FlowDetailsTooltip = DetailsTooltip.extend({
  className: 'button button--icon action-details-tooltip patient-flow__action-details',
});

export const i18n = intl.patients.patient.flow.flowViews;
const FlowHeaderOwnerComponent = FlowOwnerComponent.extend({
  viewOptions() {
    const options = FlowOwnerComponent.prototype.viewOptions.call(this);

    return extend({}, options, {
      className: `${ options.className } patient-flow__owner`,
    });
  },
});

const FlowHeaderReadOnlyOwnerView = ReadOnlyOwnerView.extend({
  className: 'patient-readonly patient-readonly--compact patient-readonly__owner patient-flow__owner js-no-click',
});

const HeaderView = View.extend({
  className: 'patient-flow__header',
  modelEvents: {
    'change': 'render',
  },
  template: HeaderTemplate,
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
  },
  templateContext() {
    return {
      canEdit: this.model.canEdit(),
    };
  },
  onRender() {
    this.canEdit = this.model.canEdit();

    this.showState();
    this.showOwner();
  },
  showState() {
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model, showLabel: true });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    const stateComponent = new FlowStateComponent({
      flow: this.model,
      stateId: this.model.getState().id,
      isCompact: true,
      showLabel: true,
    });

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new FlowHeaderReadOnlyOwnerView({ model: this.model, isCompact: true });
      this.showChildView('owner', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    const program = this.model.getProgram();
    const ownerComponent = new FlowHeaderOwnerComponent({
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
});

const ProgressView = View.extend({
  className: 'patient-flow__progress patient-list__flow-progress',
  template: hbs`
    <progress class="progress-bar" value="{{ _progress.complete }}" max="{{ _progress.total }}" aria-label="{{ _progress.complete }} / {{formatMessage (intlGet "patients.shared.listViews.countView.actionsCount") itemCount=_progress.total}}"></progress>
    <span class="patient-list__flow-progress-label">{{ _progress.complete }} / {{formatMessage (intlGet "patients.shared.listViews.countView.actionsCount") itemCount=_progress.total}}</span>
  `,
  modelEvents: {
    'change:_progress': 'render',
  },
});

const MenuView = View.extend({
  tagName: 'button',
  className: 'button button--icon button--menu patient-detail-page__menu patient-flow__menu js-menu',
  attributes: {
    'aria-label': i18n.menu.headingText,
    'title': i18n.menu.headingText,
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
  className: 'card-list__empty',
  attributes: {
    role: 'listitem',
  },
  template: hbs`<h2>{{ @intl.patients.patient.flow.flowViews.emptyView }}</h2>`,
});

const ActionItemView = View.extend({
  className: 'work-card action-card patient-flow__action-item',
  attributes: {
    role: 'listitem',
  },
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
      attachmentCount: this.model.getFiles().length,
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
  events: {
    'click .js-action-surface': 'onClickSurface',
    'click .js-no-click': stopEventPropagation,
    'click .js-primary': 'onClickPrimary',
  },
  navigateToAction() {
    Radio.trigger('event-router', 'patient:flow:action', this.model.getPatient().id, this.model.getFlow().id, this.model.id);
  },
  onClickSurface() {
    this.navigateToAction();
  },
  onClickPrimary(event) {
    event.stopPropagation();
    this.navigateToAction();
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
    const checkComponent = new CheckComponent({
      deselectLabel: intl.patients.shared.actionsViews.deselectAction,
      selectLabel: intl.patients.shared.actionsViews.selectAction,
      state: { isSelected },
    });

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

    this.showChildView('details', new FlowDetailsTooltip({ model: this.model }));
  },
  showState() {
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model });
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
      const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model });
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

    this.showChildView('form', new FlowFormButton({ model: this.model }));
  },
});

const ListView = CollectionView.extend({
  className: 'card-list patient-flow__list',
  attributes: {
    role: 'list',
  },
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
  className: 'patient__content patient__content--scroll patient-detail-page patient-flow__frame',
  template: LayoutTemplate,
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
    progress: {
      el: '[data-progress-region]',
      replaceElement: true,
    },
    selectAll: {
      el: '[data-select-all-region]',
      replaceElement: true,
    },
  },
  ui: {
    actions: '.js-actions',
  },
  setEditing(isEditing) {
    this.ui.actions.toggleClass('is-editing', isEditing);
  },
});

const SelectAllView = SharedSelectAllView.extend({
  className: 'button button--checkbox patient-flow__select-all',
});

export {
  FlowLoadingView,
  LayoutView,
  HeaderView,
  ListView,
  MenuView,
  ProgressView,
  SelectAllView,
};
