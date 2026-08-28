import { every, map, sortBy } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View, CollectionView, Behavior } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/card-list.scss';
import 'scss/modules/list-pages.scss';

import intl from 'js/i18n';

import buildMatchersArray from 'js/utils/formatting/build-matchers-array';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import PreloadRegion from 'js/regions/preload_region';
import { RoleComponent, TeamComponent, StateComponent } from 'js/apps/clinicians/shared/clinicians_views';

import ItemTemplate from './item.hbs';
import LayoutTemplate from './layout.hbs';

import './clinicians.scss';

const notFound = intl.clinicians.cliniciansAllViews.notFound;
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

const EmptyView = View.extend({
  className: 'card-list__empty',
  template: hbs`<h2>{{ @intl.clinicians.cliniciansAllViews.emptyView }}</h2>`,
});

const EmptyFindInListView = View.extend({
  className: 'card-list__empty',
  template: hbs`<h2>{{ @intl.clinicians.cliniciansAllViews.emptyFindInListView.noResults }}</h2>`,
});

const ItemView = View.extend({
  modelEvents: {
    'change:enabled': 'render',
  },
  className: 'card-list__item',
  behaviors: [RowBehavior],
  regions: {
    team: '[data-team-region]',
    role: '[data-role-region]',
    state: '[data-state-region]',
  },
  triggers: {
    'click': 'click',
  },
  events: {
    'click .js-no-click': stopEventPropagation,
  },
  template: ItemTemplate,
  templateContext() {
    return {
      workspaces: sortBy(map(this.model.getWorkspaces().models, 'attributes'), 'name'),
    };
  },
  onRender() {
    this.showTeam();
    this.showRole();
    this.showState();
  },
  onClick() {
    Radio.trigger('event-router', 'clinician', this.model.id);
  },
  showState() {
    const isActive = this.model.isActive();
    const selectedId = this.model.isEnabled() ? 'enabled' : 'disabled';

    const stateComponent = new StateComponent({ isActive, selectedId, isCompact: true });

    this.listenTo(stateComponent, 'change:selected', selected => {
      this.model.save({ enabled: selected.id !== 'disabled' });
    });

    this.showChildView('state', stateComponent);
  },
  showRole() {
    const roleComponent = new RoleComponent({
      role: this.model.getRole(),
      isCompact: true,
      state: { isDisabled: !this.model.isEnabled() },
    });

    this.listenTo(roleComponent, 'change:role', role => {
      this.model.saveRole(role);
    });

    this.showChildView('role', roleComponent);
  },
  showTeam() {
    const teamComponent = new TeamComponent({
      team: this.model.getTeam(),
      isCompact: true,
      state: { isDisabled: !this.model.isEnabled() },
    });

    this.listenTo(teamComponent, 'change:team', team => {
      this.model.saveTeam(team);
    });

    this.showChildView('team', teamComponent);
  },
});

const LayoutView = View.extend({
  className: 'flex-region list-page',
  template: LayoutTemplate,
  regions: {
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
    sidebar: '[data-sidebar-region]',
    addClinician: {
      el: '[data-add-region]',
      replaceElement: true,
    },
    search: '[data-search-region]',
  },
  triggers: {
    'click .js-add-clinician': 'click:addClinician',
  },
});

const ListView = CollectionView.extend({
  className: 'card-list list-page__list',
  childView: ItemView,
  emptyView() {
    if (this.collection.length && this.state.get('searchQuery')) {
      return EmptyFindInListView;
    }

    return EmptyView;
  },
  collectionEvents: {
    'change:name': 'sort',
  },
  childViewTriggers: {
    'render': 'listItem:render',
  },
  viewComparator({ model }) {
    return String(model.get('name')).toLowerCase();
  },
  initialize({ state }) {
    this.state = state;

    this.listenTo(state, 'change:searchQuery', this.searchList);
  },
  onAttach() {
    this.searchList(null, this.state.get('searchQuery'));
  },
  onListItemRender(view) {
    view.searchString = view.$el.text();
  },
  onRenderChildren() {
    this.triggerMethod('filtered', this.children.pluck('model'));
  },
  searchList(state, searchQuery) {
    if (!searchQuery) {
      this.removeFilter();
      return;
    }

    const matchers = buildMatchersArray(searchQuery);

    this.setFilter(function({ searchString }) {
      return every(matchers, function(matcher) {
        return matcher.test(searchString);
      });
    });
  },
});

export {
  LayoutView,
  ListView,
  notFound,
};
