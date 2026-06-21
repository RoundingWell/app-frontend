import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import PreloadRegion from 'js/regions/preload_region';

import { OwnerComponent as FlowOwnerComponent, FlowBehaviorComponent } from 'js/apps/programs/shared/flows_views';
import { DueDayComponent, OwnerComponent, BehaviorComponent } from 'js/apps/programs/shared/actions_views';
import SortableList from 'js/behaviors/sortable-list';

import ActionItemTemplate from './action-item.hbs';
import HeaderTemplate from './header.hbs';

import 'scss/domain/action-icons.scss';
import './program-flow.scss';

const ContextTrailView = View.extend({
  modelEvents: {
    'change:name': 'render',
  },
  initialize({ program }) {
    this.program = program;

    this.listenTo(this.program, 'change:name', this.render);
  },
  className: 'program-flow__context-trail',
  template: hbs`
    {{#if hasLatestList}}
      <a class="js-back program-flow__context-link">
        {{fas "chevron-left"}}{{ @intl.programs.program.flow.flowViews.contextBackBtn }}
      </a>
      {{fas "chevron-right"}}
    {{/if}}
    <a class="js-program program-flow__context-link">{{ programName }}</a>{{fas "chevron-right"}}{{ name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
    'click .js-program': 'click:program',
  },
  onClickBack() {
    Radio.request('history', 'go:latestList');
  },
  onClickProgram() {
    Radio.trigger('event-router', 'program:details', this.program.id);
  },
  templateContext() {
    return {
      hasLatestList: Radio.request('history', 'has:latestList'),
      programName: this.program.get('name'),
    };
  },
});

const HeaderView = View.extend({
  className: 'program-flow__header',
  modelEvents: {
    'editing': 'onEditing',
    'change': 'render',
  },
  onEditing(isEditing) {
    this.$el.toggleClass('is-selected', isEditing);
  },
  template: HeaderTemplate,
  regions: {
    behavior: '[data-behavior-region]',
    owner: '[data-owner-region]',
  },
  triggers: {
    'click': 'edit',
  },
  onRender() {
    this.showBehavior();
    this.showOwner();
  },
  showBehavior() {
    const behaviorComponent = new FlowBehaviorComponent({
      behavior: this.model.get('behavior'),
      isCompact: true,
    });

    this.listenTo(behaviorComponent, 'change:status', ({ behavior }) => {
      this.model.save({ behavior });
    });

    this.showChildView('behavior', behaviorComponent);
  },
  showOwner() {
    const ownerComponent = new FlowOwnerComponent({ owner: this.model.getOwner(), isCompact: true });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
});

const AddActionView = View.extend({
  className: 'program-flow__actions',
  template: hbs`
    <button class="button-primary js-add-action">
      {{far "circle-plus"}}<span>{{ @intl.programs.program.flow.flowViews.addActionBtn }}</span>
    </button>
  `,
  triggers: {
    'click .js-add-action': 'click:addAction',
  },
});

const EmptyView = View.extend({
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.programs.program.flow.flowViews.emptyView }}</h2>`,
});

const ActionItemView = View.extend({
  modelEvents: {
    'change': 'render',
    'editing': 'onEditing',
  },
  className() {
    const className = 'table-list__item program-flow__action-item js-draggable';
    if (this.model.isNew()) return `${ className } is-selected`;

    return className;
  },
  template: ActionItemTemplate,
  templateContext() {
    return {
      hasForm: this.model.getForm(),
      icon: this.model.hasOutreach() ? 'share-from-square' : 'file-lines',
    };
  },
  regions: {
    behavior: '[data-behavior-region]',
    owner: '[data-owner-region]',
    due: '[data-due-region]',
  },
  triggers: {
    'click': 'click',
  },
  onClick() {
    if (this.model.isNew()) {
      Radio.trigger('event-router', 'programFlow:action:new', this.model.getProgramFlow().id);
      return;
    }
    Radio.trigger('event-router', 'programFlow:action', this.model.getProgramFlow().id, this.model.id);
  },
  onEditing(isEditing) {
    this.$el.toggleClass('is-selected', isEditing);
  },
  onRender() {
    this.showBehavior();
    this.showOwner();
    this.showDue();
  },
  showDue() {
    const isDisabled = this.model.isNew();
    const dueDayComponent = new DueDayComponent({ day: this.model.get('days_until_due'), isCompact: true, state: { isDisabled } });

    this.listenTo(dueDayComponent, 'change:day', day => {
      this.model.save({ days_until_due: day });
    });

    this.showChildView('due', dueDayComponent);
  },
  showBehavior() {
    const isDisabled = this.model.isNew();
    const behaviorComponent = new BehaviorComponent({
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
});

const ListView = CollectionView.extend({
  behaviors: [
    {
      behaviorClass: SortableList,
      shouldDisable() {
        return this.view.collection.length < 2 || this.view.collection.last().isNew();
      },
    },
  ],
  collectionEvents: {
    'change:id': 'onChangeId',
  },
  className: 'table-list__list list-page__list program-flow__list',
  childView: ActionItemView,
  emptyView: EmptyView,
  onDragEnd() {
    this.collection.updateSequences();
  },
  onChangeId() {
    this.collection.updateSequences();
  },
});

const LayoutView = View.extend({
  className: 'program-flow__frame',
  template: hbs`
    <div class="program-flow__layout">
      <div data-context-trail-region></div>
      <div data-header-region></div>
      <div data-add-action-region></div>
      <div class="table-list program-flow__table-list">
        <div class="table-list__header list-page__list-header"></div>
        <div class="table-list__list" data-action-list-region></div>
      </div>
    </div>
    <div class="program-flow__sidebar" data-sidebar-region></div>
  `,
  regions: {
    contextTrail: {
      el: '[data-context-trail-region]',
      replaceElement: true,
    },
    header: '[data-header-region]',
    addAction: '[data-add-action-region]',
    sidebar: '[data-sidebar-region]',
    actionList: {
      el: '[data-action-list-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
  },
});

export {
  LayoutView,
  ContextTrailView,
  HeaderView,
  AddActionView,
  ListView,
};
