import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import { alphaSort } from 'js/utils/sorting';

import PreloadRegion from 'js/regions/preload_region';

import 'scss/modules/list-pages.scss';
import 'scss/modules/table-list.scss';
import './programs-list.scss';

const EmptyView = View.extend({
  className: 'table-list__empty-list',
  template: hbs`<h2>{{ @intl.programs.programsAllViews.emptyView }}</h2>`,
});

const ItemView = View.extend({
  className: 'table-list__item',
  template: hbs`
    <div data-testid="program-list-name">{{ name }}</div>
    <div class="programs-list__published{{#if published}} is-published{{/if}}">
      {{#if published}}{{fas "toggle-on"}}{{else}}{{far "toggle-off"}}{{/if}}
      {{formatMessage (intlGet "programs.programsAllViews.itemView.published") published=published}}
    </div>
    <div class="programs-list__updated-ts">{{formatDateTime updated_at "TIME_OR_DAY"}}</div>
  `,
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
  className: 'flex-region',
  template: hbs`
    <div class="list-page__header">
      <div class="flex list-page__title">
        <div class="flex list-page__title-filter">
          <span class="list-page__title-icon">{{far "screwdriver-wrench"}}</span>{{ @intl.programs.programsAllViews.layoutView.title }}
        </div>
      </div>
      <button class="u-margin--b-16 button-primary js-add">{{far "circle-plus"}}<span>{{ @intl.programs.programsAllViews.addProgramBtn }}</span></button>
    </div>
    <div class="table-list programs-list__table-list">
      <div class="table-list__header list-page__list-header">
        <div>{{ @intl.programs.programsAllViews.layoutView.programHeader }}</div>
        <div>{{ @intl.programs.programsAllViews.layoutView.stateHeader }}</div>
        <div>{{ @intl.programs.programsAllViews.layoutView.updatedHeader }}</div>
      </div>
      <div class="table-list__list" data-list-region></div>
    </div>
  `,
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
  className: 'table-list__list list-page__list',
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
