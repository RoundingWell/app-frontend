import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';
import 'scss/modules/card-list.scss';

import { alphaSort } from 'js/utils/sorting';

import PreloadRegion from 'js/regions/preload_region';

import ItemTemplate from './item.hbs';
import LayoutTemplate from './layout.hbs';

import './programs-list.scss';

const EmptyView = View.extend({
  className: 'card-list__empty',
  template: hbs`<h2>{{ @intl.programs.programsAllViews.emptyView }}</h2>`,
});

const ItemView = View.extend({
  className: 'card-list__item',
  template: ItemTemplate,
  templateContext() {
    return {
      published: !!this.model.get('published_at'),
    };
  },
  triggers: {
    'click': 'click',
  },
  onClick() {
    Radio.trigger('event-router', 'program:details', this.model.id);
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
  },
  triggers: {
    'click .js-add': 'click:add',
  },
});

const ListView = CollectionView.extend({
  className: 'card-list list-page__list',
  childView: ItemView,
  emptyView: EmptyView,
  viewComparator(viewA, viewB) {
    return alphaSort('desc', viewA.model.get('updated_at'), viewB.model.get('updated_at'));
  },
});

export {
  LayoutView,
  ListView,
};
