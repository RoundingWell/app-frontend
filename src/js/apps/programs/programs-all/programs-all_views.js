import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/list-pages.scss';
import 'scss/modules/card-list.scss';

import { alphaSort } from 'js/utils/sorting';

import { reportUrl, navigateReportLink } from 'js/apps/programs/report/report-links';

import PreloadRegion from 'js/regions/preload_region';

import ItemTemplate from './item.hbs';
import LayoutTemplate from './layout.hbs';

import './programs-list.scss';

const EmptyView = View.extend({
  tagName: 'li',
  className: 'card-list__empty',
  template: hbs`<h2>{{ @intl.programs.programsAllViews.emptyView }}</h2>`,
});

const ItemView = View.extend({
  tagName: 'li',
  className: 'card-list__item',
  template: ItemTemplate,
  templateContext() {
    return { url: reportUrl(`program/${ this.model.id }`) };
  },
  ui: { link: '.js-program-link' },
  events: { 'click @ui.link': navigateReportLink },
});

const LayoutView = View.extend({
  className: 'flex-region list-page programs-list',
  template: LayoutTemplate,
  ui: { heading: '.js-heading' },
  focusHeading() {
    this.getUI('heading')[0].focus({ preventScroll: true });
  },
  regions: {
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
  },
});

const ListView = CollectionView.extend({
  tagName: 'ul',
  className: 'card-list list-page__list',
  childView: ItemView,
  emptyView: EmptyView,
  viewComparator(viewA, viewB) {
    return alphaSort('asc', viewA.model.get('name'), viewB.model.get('name'));
  },
});

export { LayoutView, ListView };
