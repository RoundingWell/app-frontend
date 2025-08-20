import { every } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import PreloadRegion from 'js/regions/preload_region';

const ItemView = View.extend({
  template: hbs`
    <div>{{ name }}</div>
  `,
  className: 'table-list__item',
  triggers: {
    'click': 'click',
  },
  onClick() {
    Radio.trigger('event-router', 'dashboard', this.model.id);
  },
});

const EmptyView = View.extend({
  template: hbs`
    <h2>{{ @intl.dashboards.dashboardsAllViews.emptyView }}</h2>
  `,
  className: 'table-list__empty-list',
});

const EmptyFindInListView = View.extend({
  template: hbs`
    <h2>{{ @intl.dashboards.dashboardsAllViews.emptyFindInListView.noResults }}</h2>
  `,
  className: 'table-list__empty-list',
});

const ListView = CollectionView.extend({
  childView: ItemView,
  className: 'table-list__list list-page__list',
  emptyView() {
    if (this.collection.length && this.state.get('searchQuery')) {
      return EmptyFindInListView;
    }

    return EmptyView;
  },
  childViewTriggers: {
    'render': 'listItem:render',
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

const LayoutView = View.extend({
  className: 'flex-region',
  template: hbs`
    <div class="list-page__header">
      <div class="flex list-page__title">
        <div class="flex list-page__title-filter">
          <span class="list-page__title-icon">{{far "gauge"}}</span>{{ @intl.dashboards.dashboardsAllViews.layoutView.title }}
        </div>
        <div class="u-margin--l-auto" data-search-region></div>
      </div>
    </div>
    <div class="table-list dashboards__table-list">
      <div class="table-list__header list-page__list-header">
        <div>{{ @intl.dashboards.dashboardsAllViews.layoutView.nameHeader }}</div>
      </div>
      <div data-list-region></div>
    </div>
  `,
  regions: {
    search: '[data-search-region]',
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
  },
});

export {
  LayoutView,
  ListView,
};
