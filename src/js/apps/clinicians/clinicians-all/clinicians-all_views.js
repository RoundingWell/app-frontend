import { every, map, sortBy } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View, CollectionView, Behavior } from 'marionette';

import intl from 'js/i18n';

import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import PreloadRegion from 'js/regions/preload_region';
import { RoleComponent, TeamComponent, StateComponent } from 'js/apps/clinicians/shared/clinicians_views';

import 'scss/modules/list-pages.scss';
import 'scss/modules/table-list.scss';

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
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.clinicians.cliniciansAllViews.emptyView }}</h2>`,
});

const EmptyFindInListView = View.extend({
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.clinicians.cliniciansAllViews.emptyFindInListView.noResults }}</h2>`,
});

const ItemView = View.extend({
  modelEvents: {
    'change:enabled': 'render',
  },
  className: 'table-list__item',
  behaviors: [RowBehavior],
  regions: {
    team: '[data-team-region]',
    role: '[data-role-region]',
    state: '[data-state-region]',
  },
  triggers: {
    'click': 'click',
  },
  template: hbs`
    <div class="u-text--overflow">{{#unless name}}{{ @intl.clinicians.cliniciansAllViews.itemView.newClinician }}{{/unless}}{{ name }}&#8203;</div>
    <div class="u-text--overflow-two-lines{{#unless workspaces}} table-list__cell--empty{{/unless}}">{{#each workspaces}}{{#unless @first}}, {{/unless}}{{ this.name }}{{/each}}{{#unless workspaces}}{{ @intl.clinicians.cliniciansAllViews.itemView.noWorkspaces }}{{/unless}}&#8203;</div>
    <div class="table-list__meta">
      <span><span data-state-region></span>&#8203;</span>
      <span><span data-role-region></span>&#8203;</span>
      <span><span data-team-region></span>&#8203;</span>
    </div>
    <div class="{{#unless last_active_at}} table-list__cell--empty{{/unless}}">{{formatDateTime last_active_at "TIME_OR_DAY" defaultHtml=(intlGet "clinicians.cliniciansAllViews.itemView.noLastActive")}}&#8203;</div>
  `,
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
  className: 'flex-region',
  template: hbs`
    <div class="list-page__header">
      <div class="flex list-page__title">
        <div class="flex list-page__title-filter">
          <span class="list-page__title-icon">{{far "users-gear"}}</span>{{ @intl.clinicians.cliniciansAllViews.layoutView.title }}
        </div>
        <div class="clinicians__list-search" data-search-region></div>
      </div>
      <button class="u-margin--b-16 button-primary js-add-clinician">{{far "circle-plus"}}<span>{{ @intl.clinicians.cliniciansAllViews.layoutView.addClinicianButton }}</span></button>
    </div>
    <div class="table-list clinicians-list__table-list">
      <div class="table-list__header list-page__list-header">
        <div>{{ @intl.clinicians.cliniciansAllViews.layoutView.clinicianHeader }}</div>
        <div>{{ @intl.clinicians.cliniciansAllViews.layoutView.workspacesHeader }}</div>
        <div>{{ @intl.clinicians.cliniciansAllViews.layoutView.attributesHeader }}</div>
        <div>{{ @intl.clinicians.cliniciansAllViews.layoutView.lastActiveHeader }}</div>
      </div>
      <div class="list-page__list" data-list-region></div>
    </div>
  `,
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
  className: 'table-list__list list-page__list',
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
