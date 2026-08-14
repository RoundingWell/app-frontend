import { animate } from 'animejs';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView, Behavior } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/loader.scss';
import 'scss/modules/progress-bar.scss';
import 'scss/modules/card-list.scss';
import 'scss/modules/skeleton.scss';

import { alphaSort } from 'js/utils/sorting';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import PreloadRegion from 'js/regions/preload_region';

import { StateComponent, OwnerComponent, DueComponent, TimeComponent, FormButton, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateView, ReadOnlyDueTimeView } from 'js/apps/patients/shared/read-only_views';

import ActionItemTemplate from './action-item.hbs';
import DoneLayoutTemplate from './done-layout.hbs';
import FlowItemTemplate from './flow-item.hbs';
import LayoutTemplate from './layout.hbs';
import LoadingTemplate from './loading.hbs';

import 'js/apps/patients/shared/action-state.scss';
import 'scss/domain/work-card.scss';
import 'scss/domain/action-card.scss';
import 'scss/domain/flow-card.scss';
import 'scss/domain/patient-list.scss';
import '../patient.scss';
import './workflow-page.scss';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const NotDoneEmptyView = View.extend({
  className: 'card-list__empty',
  attributes: {
    role: 'listitem',
  },
  template: hbs`<h2>{{ @intl.patients.patient.workflow.workflowViews.notDoneEmptyView }}</h2>`,
});

const DoneEmptyView = View.extend({
  className: 'card-list__empty',
  attributes: {
    role: 'listitem',
  },
  template: hbs`<h2>{{ @intl.patients.patient.workflow.workflowViews.doneEmptyView }}</h2>`,
});

const WorkflowLoadingView = View.extend({
  className: 'loader workflow-page__loader',
  attributes: {
    'aria-busy': 'true',
    'role': 'status',
  },
  template: LoadingTemplate,
  templateContext() {
    return { items: new Array(2).fill(null) };
  },
});

const RowBehavior = Behavior.extend({
  modelEvents: {
    'change': 'onChange',
  },
  onChange() {
    this.view.render();
  },
});

const StatusBehavior = Behavior.extend({
  modelEvents: {
    'change:_state': 'onChangeState',
  },
  onChangeState() {
    const isVisible = this.view.getOption('status') === 'done' ?
      this.view.model.isDone() :
      !this.view.model.isDone();

    if (!isVisible) {
      animate(this.el, {
        delay: 300,
        opacity: { to: 0, duration: 500 },
        ease: 'outQuad',
        onComplete: () => {
          this.view.triggerMethod('change:visible');
        },
      });

      return;
    }

    this.$el.css({
      opacity: 1,
    });

    this.view.triggerMethod('change:visible');
  },
});

const ActionItemView = View.extend({
  className: 'work-card action-card',
  attributes: {
    role: 'listitem',
  },
  behaviors: [RowBehavior, StatusBehavior],
  regions: {
    details: '[data-details-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDate: '[data-due-date-region]',
    dueTime: '[data-due-time-region]',
    form: '[data-form-region]',
  },
  template: ActionItemTemplate,
  templateContext() {
    return {
      attachmentCount: this.model.getFiles().length,
      commentCount: this.model.commentCount(),
    };
  },
  triggers: {
    'click': 'click',
  },
  events: {
    'click .js-no-click': stopEventPropagation,
    'click .js-primary': 'onClickPrimary',
  },
  onClick() {
    Radio.trigger('event-router', 'patient:action', this.model.getPatient().id, this.model.id);
  },
  onClickPrimary(event) {
    event.stopPropagation();
    this.onClick();
  },
  onRender() {
    this.canEdit = this.model.canEdit();

    this.showDetailsTooltip();
    this.showState();
    this.showOwner();
    this.showDueDate();
    this.showDueTime();
    this.showForm();
  },
  showDetailsTooltip() {
    if (!this.model.get('details')) return;

    this.showChildView('details', new DetailsTooltip({ model: this.model }));
  },
  showState() {
    if (!this.canEdit) {
      this.showChildView('state', new ReadOnlyStateView({ model: this.model }));
      return;
    }

    const stateComponent = new StateComponent({ stateId: this.model.getState().id, isCompact: true });

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    if (!this.canEdit) {
      this.showChildView('owner', new ReadOnlyOwnerView({ model: this.model }));
      return;
    }

    const program = this.model.getProgram();
    const isDisabled = this.getOption('status') === 'done';
    const ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
      state: { isDisabled },
    });

    if (!isDisabled) {
      this.listenTo(ownerComponent, 'change:owner', owner => {
        this.model.saveOwner(owner);
      });
    }

    this.showChildView('owner', ownerComponent);
  },
  showDueDate() {
    if (!this.canEdit) {
      this.showChildView('dueDate', new ReadOnlyDueDateView({ model: this.model }));
      return;
    }

    const isDisabled = this.getOption('status') === 'done';
    const dueDateComponent = new DueComponent({
      date: this.model.get('due_date'),
      isCompact: true,
      state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    if (!isDisabled) {
      this.listenTo(dueDateComponent, 'change:due', date => {
        this.model.saveDueDate(date);
      });
    }

    this.showChildView('dueDate', dueDateComponent);
  },
  showDueTime() {
    if (!this.canEdit) {
      this.showChildView('dueTime', new ReadOnlyDueTimeView({ model: this.model }));
      return;
    }

    const isDisabled = this.getOption('status') === 'done' || !this.model.get('due_date');
    const dueTimeComponent = new TimeComponent({
      time: this.model.get('due_time'),
      isCompact: true,
      state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    if (!isDisabled) {
      this.listenTo(dueTimeComponent, 'change:time', time => {
        this.model.saveDueTime(time);
      });
    }

    this.showChildView('dueTime', dueTimeComponent);
  },
  showForm() {
    if (!this.model.getForm()) return;

    this.showChildView('form', new FormButton({ model: this.model }));
  },
});

const FlowItemView = View.extend({
  className: 'work-card flow-card',
  attributes: {
    role: 'listitem',
  },
  behaviors: [RowBehavior, StatusBehavior],
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
  },
  template: FlowItemTemplate,
  triggers: {
    'click': 'click',
  },
  events: {
    'click .js-no-click': stopEventPropagation,
    'click .js-primary': 'onClickPrimary',
  },
  onClick() {
    Radio.trigger('event-router', 'patient:flow', this.model.getPatient().id, this.model.id);
  },
  onClickPrimary(event) {
    event.stopPropagation();
    this.onClick();
  },
  onRender() {
    this.canEdit = this.model.canEdit();

    this.showState();
    this.showOwner();
  },
  showState() {
    if (this.getOption('status') !== 'done' || !this.canEdit) {
      this.showChildView('state', new ReadOnlyStateView({ model: this.model }));
      return;
    }

    const stateComponent = new StateComponent({ stateId: this.model.getState().id, isCompact: true });

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    if (!this.canEdit) {
      this.showChildView('owner', new ReadOnlyOwnerView({ model: this.model }));
      return;
    }

    const program = this.model.getProgram();
    const isDisabled = this.getOption('status') === 'done';
    const ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
      state: { isDisabled },
    });

    if (!isDisabled) {
      this.listenTo(ownerComponent, 'change:owner', owner => {
        this.model.saveOwner(owner);
      });
    }

    this.showChildView('owner', ownerComponent);
  },
});

const ListView = CollectionView.extend({
  childViewEvents: {
    'change:visible': 'filter',
  },
  className: 'card-list workflow-page__list',
  attributes: {
    role: 'list',
  },
  initialize({ status }) {
    this.status = status;
    this.emptyView = status === 'done' ? DoneEmptyView : NotDoneEmptyView;
  },
  childView(item) {
    if (item.type === 'flows') return FlowItemView;

    return ActionItemView;
  },
  childViewOptions() {
    return { status: this.status };
  },
  viewComparator({ model: modelA }, { model: modelB }) {
    return alphaSort('desc', modelA.get('updated_at'), modelB.get('updated_at'));
  },
  viewFilter({ model }) {
    if (this.status === 'done') return model.isDone();

    return !model.isDone();
  },
});

const LayoutView = View.extend({
  className: 'patient__content patient__content--scroll flex-region',
  regions() {
    const regions = {
      content: {
        el: '[data-content-region]',
        regionClass: PreloadRegion,
        replaceElement: true,
      },
    };

    if (this.getOption('status') === 'notDone') {
      regions.addWorkflow = '[data-add-workflow-region]';
    }

    return regions;
  },
  ui: {
    loading: '.js-loading',
  },
  getTemplate() {
    if (this.getOption('status') === 'done') return DoneLayoutTemplate;

    return LayoutTemplate;
  },
  triggers: {
    'click .js-archive': 'click:archive',
    'click .js-dashboard': 'click:dashboard',
  },
  onClickArchive() {
    Radio.trigger('event-router', 'patient:workflow:closed', this.model.id);
  },
  onClickDashboard() {
    Radio.trigger('event-router', 'patient:workflow', this.model.id);
  },
  onRender() {
    if (this.getOption('status') === 'done' || window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    this.listenToOnce(this.getRegion('content'), 'before:empty', this.stopLoadingAnimation);
    this.loadingAnimation = animate(this.ui.loading[0], {
      opacity: { from: 0.5, duration: 400 },
      loop: Infinity,
      ease: 'inOutSine',
      alternate: true,
    });
  },
  onBeforeRender() {
    this.stopLoadingAnimation();
  },
  onBeforeDestroy() {
    this.stopLoadingAnimation();
  },
  stopLoadingAnimation() {
    if (!this.loadingAnimation) return;

    this.loadingAnimation.cancel();
    this.loadingAnimation = null;
  },
});

export {
  ListView,
  LayoutView,
  WorkflowLoadingView,
};
