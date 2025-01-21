import { every, map, sortBy } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View, CollectionView, Behavior } from 'marionette';

import intl from 'js/i18n';

import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import PreloadRegion from 'js/regions/preload_region';
import { RoleComponent, TeamComponent, StateComponent } from 'js/views/clinicians/shared/clinicians_views';

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
  tagName: 'tr',
  template: hbs`
    <td class="table-empty-list">
      <h2>{{ @intl.clinicians.cliniciansAllViews.emptyView }}</h2>
    </td>
  `,
});

const EmptyFindInListView = View.extend({
  tagName: 'tr',
  template: hbs`
    <td class="table-empty-list">
      <h2>{{ @intl.clinicians.cliniciansAllViews.emptyFindInListView.noResults }}</h2>
    </td>
  `,
});

const ItemView = View.extend({
  modelEvents: {
    'change:enabled': 'render',
  },
  className: 'table-list__item',
  behaviors: [RowBehavior],
  tagName: 'tr',
  regions: {
    team: '[data-team-region]',
    role: '[data-role-region]',
    state: '[data-state-region]',
  },
  triggers: {
    'click': 'click',
  },
  template: hbs`
    <td class="table-list__cell w-20">{{#unless name}}{{ @intl.clinicians.cliniciansAllViews.itemView.newClinician }}{{/unless}}{{ name }}&#8203;</td>
    <td class="table-list__cell w-30 {{#unless workspaces}}table-list__cell--empty{{/unless}}">{{#each workspaces}}{{#unless @first}}, {{/unless}}{{ this.name }}{{/each}}{{#unless workspaces}}{{ @intl.clinicians.cliniciansAllViews.itemView.noWorkspaces }}{{/unless}}&#8203;</td>
    <td class="table-list__cell w-30">
      <span class="u-margin--r-8" data-state-region></span>&#8203;{{~ remove_whitespace ~}}
      <span class="u-margin--r-8" data-role-region></span>&#8203;{{~ remove_whitespace ~}}
      <span data-team-region></span>&#8203;{{~ remove_whitespace ~}}
    </td>
    <td class="table-list__cell w-20 {{#unless last_active_at}}table-list__cell--empty{{/unless}}">{{formatDateTime last_active_at "TIME_OR_DAY" defaultHtml=(intlGet "clinicians.cliniciansAllViews.itemView.noLastActive")}}&#8203;</td>
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
    <div class="flex-region list-page__list">
      <table class="w-100"><tr>
        <td class="table-list__header w-20">{{ @intl.clinicians.cliniciansAllViews.layoutView.clinicianHeader }}</td>
        <td class="table-list__header w-30">{{ @intl.clinicians.cliniciansAllViews.layoutView.workspacesHeader }}</td>
        <td class="table-list__header w-30">{{ @intl.clinicians.cliniciansAllViews.layoutView.attributesHeader }}</td>
        <td class="table-list__header w-20">{{ @intl.clinicians.cliniciansAllViews.layoutView.lastActiveHeader }}</td>
      </tr></table>
      <div class="flex-region" data-list-region></div>
    </div>
  `,
  regions: {
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
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
  className: 'table-list',
  tagName: 'table',
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
