import { every, map, sortBy } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView, Behavior } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/card-list.scss';
import 'scss/modules/list-pages.scss';

import intl from 'js/i18n';

import buildMatchersArray from 'js/utils/formatting/build-matchers-array';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import PreloadRegion from 'js/regions/preload_region';
import Droplist from 'js/components/droplist';
import { RoleComponent, TeamComponent, StateComponent } from 'js/apps/clinicians/shared/clinicians_views';

import ItemTemplate from './item.hbs';
import LayoutTemplate from './layout.hbs';

import './clinicians.scss';

const notFound = intl.clinicians.cliniciansAllViews.notFound;
const statusFilterI18n = intl.clinicians.cliniciansAllViews.statusFilterView;

function matchesStatusFilter(clinician, statusFilter) {
  if (statusFilter === 'disabled') return !clinician.isEnabled();
  if (statusFilter === 'enabled') return clinician.isEnabled();

  return clinician.isEnabled() && clinician.isActive();
}

const RowBehavior = Behavior.extend({
  modelEvents: {
    'editing': 'onEditing',
    'change': 'onChange',
  },
  onChange() {
    this.view.render();
  },
  onEditing(isEditing) {
    this.el.classList.toggle('is-selected', isEditing);
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
      stateOptions: { isDisabled: !this.model.isEnabled() },
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
      stateOptions: { isDisabled: !this.model.isEnabled() },
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
    statusFilter: '[data-status-filter-region]',
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

    this.listenTo(state, 'change:searchQuery change:statusFilter', this.filterList);
  },
  onAttach() {
    this.filterList();
  },
  onListItemRender(view) {
    view.searchString = view.el.textContent;
  },
  onRenderChildren() {
    this.triggerMethod('filtered', this.children.pluck('model'));
  },
  filterList() {
    const searchQuery = this.state.get('searchQuery');
    const statusFilter = this.state.get('statusFilter');
    const matchers = searchQuery ? buildMatchersArray(searchQuery) : null;

    this.setFilter(function(view) {
      if (!matchesStatusFilter(view.model, statusFilter)) return false;
      if (!matchers) return true;

      return every(matchers, function(matcher) {
        return matcher.test(view.searchString);
      });
    });
  },
});

const StatusFilterView = Droplist.extend({
  align: 'right',
  className: 'button button--secondary button--pill',
  popWidth: 192,
  picklistOptions: {
    headingText: statusFilterI18n.headingText,
  },
  initialize({ statusFilter }) {
    this.collection = new Backbone.Collection([
      {
        id: 'active',
        text: statusFilterI18n.active,
      },
      {
        id: 'enabled',
        text: statusFilterI18n.enabled,
      },
      {
        id: 'disabled',
        text: statusFilterI18n.disabled,
      },
    ]);

    this.getState().set('selected', this.collection.get(statusFilter));
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:statusFilter', selected.id);
  },
});

export {
  LayoutView,
  ListView,
  StatusFilterView,
  notFound,
};
