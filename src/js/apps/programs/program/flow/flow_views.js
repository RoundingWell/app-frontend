import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/card-list.scss';

import stopEventPropagation from 'js/utils/stop-event-propagation';

import PreloadRegion from 'js/regions/preload_region';
import SortableList from 'js/behaviors/sortable-list';

import { OwnerComponent as FlowOwnerComponent, FlowBehaviorComponent } from 'js/apps/programs/shared/flows_views';
import { DueDayComponent, OwnerComponent, BehaviorComponent } from 'js/apps/programs/shared/actions_views';

import ActionItemTemplate from './action-item.hbs';
import HeaderTemplate from './header.hbs';
import LayoutTemplate from './layout.hbs';

import 'js/apps/programs/shared/program-page.scss';
import 'scss/domain/work-card.scss';
import 'scss/domain/action-card.scss';
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
  className: 'program-page__context-trail program-page__context-trail--compact',
  template: hbs`
    {{#if hasLatestList}}
      <button class="js-back program-page__context-link" type="button">
        {{fas "chevron-left"}}{{ @intl.programs.program.flow.flowViews.contextBackBtn }}
      </button>
      {{fas "chevron-right"}}
    {{/if}}
    <button class="js-program program-page__context-link" type="button">{{ programName }}</button>{{fas "chevron-right"}}{{ name }}
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
    <button class="button button--outline js-add-action" type="button">
      {{far "circle-plus"}}<span>{{ @intl.programs.program.flow.flowViews.addActionBtn }}</span>
    </button>
  `,
  triggers: {
    'click .js-add-action': 'click:addAction',
  },
});

const EmptyView = View.extend({
  className: 'card-list__empty',
  template: hbs`<h2>{{ @intl.programs.program.flow.flowViews.emptyView }}</h2>`,
});

const ActionItemView = View.extend({
  modelEvents: {
    'change': 'render',
    'editing': 'onEditing',
  },
  className() {
    const className = 'work-card action-card program-flow__action-item js-draggable';
    if (this.model.isNew()) return `${ className } is-selected`;

    return className;
  },
  template: ActionItemTemplate,
  templateContext() {
    return {
      hasForm: this.model.getForm(),
      icon: this.model.hasOutreach() ? 'share-from-square' : null,
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
  events: {
    'click .js-no-click': stopEventPropagation,
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
      draggableClass: 'program-flow__list--draggable',
      draggingClass: 'program-flow__list--dragging',
      ghostClass: 'program-flow__action-item--ghost',
      shouldDisable() {
        return this.view.collection.length < 2 || this.view.collection.last().isNew();
      },
    },
  ],
  collectionEvents: {
    'change:id': 'onChangeId',
  },
  className: 'card-list program-flow__list',
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
  className: 'program-page__frame',
  template: LayoutTemplate,
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
