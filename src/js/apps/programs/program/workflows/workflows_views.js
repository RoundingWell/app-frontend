import Radio from 'backbone.radio';

import hbs from 'handlebars-inline-precompile';
import { View, CollectionView, Behavior } from 'marionette';

import { alphaSort } from 'js/utils/sorting';

import 'scss/modules/buttons.scss';
import 'scss/modules/table-list.scss';

import { PROGRAM_BEHAVIORS } from 'js/static';
import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import PreloadRegion from 'js/regions/preload_region';

import { OwnerComponent as FlowOwnerComponent } from 'js/apps/programs/shared/flows_views';
import { DueDayComponent, OwnerComponent, BehaviorComponent } from 'js/apps/programs/shared/actions_views';

import ActionItemTemplate from './action-item.hbs';
import FlowItemTemplate from './flow-item.hbs';
import LayoutTemplate from './layout.hbs';

import 'js/apps/programs/shared/program-action-state.scss';
import 'scss/domain/action-icons.scss';
import './workflows.scss';

const EmptyView = View.extend({
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.programs.program.workflows.workflowsViews.emptyView }}</h2>`,
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
  onInitialize() {
    if (this.view.model.isNew()) this.$el.addClass('is-selected');
  },
});

const ActionItemView = View.extend({
  className: 'table-list__item',
  behaviors: [RowBehavior],
  regions: {
    behavior: '[data-behavior-region]',
    owner: '[data-owner-region]',
    due: '[data-due-region]',
  },
  template: ActionItemTemplate,
  templateContext() {
    return {
      hasForm: this.model.getForm(),
      icon: this.model.hasOutreach() ? 'share-from-square' : 'file-lines',
    };
  },
  triggers: {
    'click': 'click',
  },
  onClick() {
    if (this.model.isNew()) {
      Radio.trigger('event-router', 'program:action:new', this.model.getProgram().id);
      return;
    }

    Radio.trigger('event-router', 'program:action', this.model.getProgram().id, this.model.id);
  },
  onRender() {
    this.showBehavior();
    this.showOwner();
    this.showDue();
  },
  showBehavior() {
    const isDisabled = this.model.isNew();
    const isFromFlow = !!this.model.getProgramFlow();
    const behaviorComponent = new BehaviorComponent({
      isConditionalAvailable: isFromFlow,
      behavior: this.model.get('behavior'),
      isCompact: true,
      state: { isDisabled },
    });

    this.listenTo(behaviorComponent, 'change:status', ({ behavior }) => {
      this.model.save({ behavior });
    });

    this.showChildView('behavior', behaviorComponent);
  },
  showOwner() {
    const isDisabled = this.model.isNew();
    const isFromFlow = !!this.model.getProgramFlow();
    const ownerComponent = new OwnerComponent({ owner: this.model.getOwner(), isFromFlow, isCompact: true, state: { isDisabled } });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  showDue() {
    const isDisabled = this.model.isNew();
    const dueDayComponent = new DueDayComponent({ day: this.model.get('days_until_due'), isCompact: true, state: { isDisabled } });

    this.listenTo(dueDayComponent, 'change:day', day => {
      this.model.save({ days_until_due: day });
    });

    this.showChildView('due', dueDayComponent);
  },
});

const FlowItemView = View.extend({
  className: 'table-list__item',
  behaviors: [RowBehavior],
  regions: {
    owner: '[data-owner-region]',
  },
  template: FlowItemTemplate,
  templateContext() {
    return {
      published: !!this.model.get('published_at'),
      isAutomated: this.model.get('behavior') === PROGRAM_BEHAVIORS.AUTOMATED,
    };
  },
  triggers: {
    'click': 'click',
  },
  onClick() {
    if (this.model.isNew()) {
      Radio.trigger('event-router', 'programFlow:new', this.model.getProgram().id);
      return;
    }

    Radio.trigger('event-router', 'programFlow', this.model.id);
  },
  onRender() {
    this.showOwner();
  },
  showOwner() {
    const isDisabled = this.model.isNew();
    const ownerComponent = new FlowOwnerComponent({ owner: this.model.getOwner(), isCompact: true, state: { isDisabled } });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
});

const ListView = CollectionView.extend({
  className: 'table-list__list list-page__list',
  childView(item) {
    if (item.type === 'program-flows') {
      return FlowItemView;
    }

    return ActionItemView;
  },
  emptyView: EmptyView,
  viewComparator(viewA, viewB) {
    return alphaSort('desc', viewA.model.get('updated_at'), viewB.model.get('updated_at'));
  },
});

const LayoutView = View.extend({
  className: 'flex-region workflows__content',
  regions: {
    content: {
      el: '[data-content-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
    add: '[data-add-region]',
  },
  template: LayoutTemplate,
});

const AddActionDroplist = Droplist.extend({
  popWidth: 248,
  picklistOptions() {
    return {
      headingText: intl.programs.program.workflows.workflowsViews.addActionHeading,
      itemClassName: 'u-text--italic',
    };
  },
  viewOptions: {
    className: 'button-primary',
    template: hbs`{{far "circle-plus"}}<span>{{ @intl.programs.program.workflows.workflowsViews.addAction }}</span>{{far "angle-down" classes="workflows__arrow"}}`,
  },
  picklistEvents: {
    'picklist:item:select': 'onSelect',
  },
  onSelect({ model }) {
    model.get('onSelect')();
  },
});

export {
  ListView,
  LayoutView,
  AddActionDroplist,
};
