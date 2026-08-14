import { every } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/list-pages.scss';
import 'scss/modules/card-list.scss';

import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import PreloadRegion from 'js/regions/preload_region';

import ItemTemplate from './item.hbs';
import LayoutTemplate from './layout.hbs';

const ItemView = View.extend({
  template: ItemTemplate,
  className: 'card-list__item',
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
  className: 'card-list__empty',
});

const EmptyFindInListView = View.extend({
  template: hbs`
    <h2>{{ @intl.dashboards.dashboardsAllViews.emptyFindInListView.noResults }}</h2>
  `,
  className: 'card-list__empty',
});

const ListView = CollectionView.extend({
  childView: ItemView,
  className: 'card-list list-page__list',
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
  className: 'flex-region list-page',
  template: LayoutTemplate,
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
