import { animate } from 'animejs';
import Radio from 'backbone.radio';

import hbs from 'handlebars-inline-precompile';
import { View, CollectionView, Behavior } from 'marionette';

import { alphaSort } from 'js/utils/sorting';

import 'scss/modules/buttons.scss';
import 'scss/modules/progress-bar.scss';
import 'scss/modules/table-list.scss';

import PreloadRegion from 'js/regions/preload_region';

import { StateComponent, OwnerComponent, DueComponent, TimeComponent, FormButton, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateView, ReadOnlyDueTimeView } from 'js/apps/patients/shared/read-only_views';

import ActionItemTemplate from './action-item.hbs';
import FlowItemTemplate from './flow-item.hbs';
import LayoutTemplate from './layout.hbs';

import 'js/apps/patients/shared/action-state.scss';
import 'scss/domain/action-icons.scss';
import '../patient.scss';

const EmptyView = View.extend({
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.patients.patient.dashboard.dashboardViews.emptyView }}</h2>`,
});

const RowBehavior = Behavior.extend({
  modelEvents: {
    'editing': 'onEditing',
    'change': 'onChange',
  },
  onChange() {
    this.view.render();
  },
  onEditing(isEditing) {
    this.$el.toggleClass('is-selected', isEditing);
  },
});

const DoneBehavior = Behavior.extend({
  modelEvents: {
    'change:_state': 'onChangeState',
  },
  onChangeState() {
    if (this.view.model.isDone()) {
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
  className: 'table-list__item',
  behaviors: [RowBehavior, DoneBehavior],
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
      icon: this.model.hasOutreach() ? 'share-from-square' : 'file-lines',
      hasAttachments: this.model.hasAttachments(),
      commentCount: this.model.commentCount(),
    };
  },
  triggers: {
    'click': 'click',
    'click .js-no-click': 'prevent-row-click',
  },
  onClick() {
    Radio.trigger('event-router', 'patient:action', this.model.getPatient().id, this.model.id);
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
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model, isCompact: true });
      this.showChildView('state', readOnlyStateView);
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
      const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model, isCompact: true });
      this.showChildView('owner', readOnlyOwnerView);
      return;
    }

    const program = this.model.getProgram();
    const ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
    });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  showDueDate() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueDateView({ model: this.model });
      this.showChildView('dueDate', readOnlyOwnerView);
      return;
    }

    const dueDateComponent = new DueComponent({
      date: this.model.get('due_date'),
      isCompact: true,
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(dueDateComponent, 'change:due', date => {
      this.model.saveDueDate(date);
    });

    this.showChildView('dueDate', dueDateComponent);
  },
  showDueTime() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueTimeView({ model: this.model });
      this.showChildView('dueTime', readOnlyOwnerView);
      return;
    }

    const isDisabled = !this.model.get('due_date');
    const dueTimeComponent = new TimeComponent({
      time: this.model.get('due_time'),
      isCompact: true, state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(dueTimeComponent, 'change:time', time => {
      this.model.saveDueTime(time);
    });

    this.showChildView('dueTime', dueTimeComponent);
  },
  showForm() {
    if (!this.model.getForm()) return;

    this.showChildView('form', new FormButton({ model: this.model }));
  },
});

const FlowItemView = View.extend({
  className: 'table-list__item',
  modelEvents: {
    'change:_owner': 'render',
  },
  behaviors: [RowBehavior, DoneBehavior],
  regions: {
    owner: '[data-owner-region]',
  },
  template: FlowItemTemplate,
  templateContext() {
    const stateOptions = this.model.getState().get('options');

    return {
      stateOptions,
    };
  },
  triggers: {
    'click': 'click',
    'click .js-no-click': 'prevent-row-click',
  },
  onClick() {
    Radio.trigger('event-router', 'flow', this.model.id);
  },
  onRender() {
    this.canEdit = this.model.canEdit();

    this.showOwner();
  },
  showOwner() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model, isCompact: true });
      this.showChildView('owner', readOnlyOwnerView);
      return;
    }

    const program = this.model.getProgram();
    const ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
    });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
});

const ListView = CollectionView.extend({
  childViewEvents: {
    'change:visible': 'filter',
  },
  className: 'table-list__list list-page__list',
  childView(item) {
    if (item.type === 'flows') {
      return FlowItemView;
    }

    return ActionItemView;
  },
  emptyView: EmptyView,
  viewComparator(viewA, viewB) {
    return alphaSort('desc', viewA.model.get('updated_at'), viewB.model.get('updated_at'));
  },
  viewFilter({ model }) {
    return !model.isDone();
  },
});

const LayoutView = View.extend({
  className: 'flex-region',
  regions: {
    content: {
      el: '[data-content-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
    addWorkflow: '[data-add-workflow-region]',
  },
  ui: {
    loading: '.js-loading',
  },
  template: LayoutTemplate,
  triggers: {
    'click .js-archive': 'click:archive',
  },
  onClickArchive() {
    Radio.trigger('event-router', 'patient:archive', this.model.id);
  },
  onRender() {
    animate(this.ui.loading[0], {
      opacity: { from: 0.5, duration: 400 },
      loop: Infinity,
      ease: 'inOutSine',
      alternate: true,
    });
  },
});

export {
  ListView,
  LayoutView,
};
