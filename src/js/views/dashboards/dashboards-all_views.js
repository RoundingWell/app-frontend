import { every } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import FixListWidthBehavior from 'js/behaviors/fix-list-width';

import PreloadRegion from 'js/regions/preload_region';

const ItemView = View.extend({
  template: hbs`
    <td class="table-list__cell w-100">{{ name }}</td>
  `,
  className: 'table-list__item',
  tagName: 'tr',
  triggers: {
    'click': 'click',
  },
  onClick() {
    Radio.trigger('event-router', 'dashboard', this.model.id);
  },
});

const EmptyView = View.extend({
  tagName: 'tr',
  template: hbs`
    <td class="table-empty-list">
      <h2>{{ @intl.dashboards.dashboardsAllViews.emptyView }}</h2>
    </td>
  `,
});

const EmptyFindInListView = View.extend({
  tagName: 'tr',
  template: hbs`
    <td class="table-empty-list">
      <h2>{{ @intl.dashboards.dashboardsAllViews.emptyFindInListView.noResults }}</h2>
    </td>
  `,
});

const ListView = CollectionView.extend({
  childView: ItemView,
  className: 'table-list',
  tagName: 'table',
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
  behaviors: [FixListWidthBehavior],
  template: hbs`
    <div class="list-page__header js-list-header">
      <div class="flex list-page__title">
        <div class="flex list-page__title-filter">
          <span class="list-page__title-icon">{{far "gauge"}}</span>{{ @intl.dashboards.dashboardsAllViews.layoutView.title }}
        </div>
        <div class="u-margin--l-auto" data-search-region></div>
      </div>
      <table class="w-100">
        <tr>
          <td class="table-list__header w-100">{{ @intl.dashboards.dashboardsAllViews.layoutView.nameHeader }}</td>
        </tr>
      </table>
    </div>
    <div class="flex-region list-page__list js-list" data-list-region></div>
  `,
  regions: {
    search: '[data-search-region]',
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
    },
  },
  childViewTriggers: {
    'render:children': 'childView:render:children',
    'attach': 'childView:attach',
  },
});

export {
  LayoutView,
  ListView,
};
