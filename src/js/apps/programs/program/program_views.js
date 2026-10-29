import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import 'scss/modules/card-list.scss';

import intl from 'js/i18n';

import { getItemContext, EmptyView, ActionListView } from 'js/apps/programs/shared/program_views';
import { SidebarView } from 'js/apps/programs/program/sidebar/sidebar-views';

import FlowItemTemplate from './flow-item.hbs';
import LayoutTemplate from './layout.hbs';

import 'js/apps/programs/shared/program-page.scss';

const i18n = intl.programs.program.programViews;

const ContextTrailView = View.extend({
  className: 'program-page__context-trail',
  template: hbs`
    {{#if hasLatestList}}
      <button class="js-back program-page__context-link" type="button">
        {{fas "chevron-left"}}{{ @intl.programs.program.programViews.contextBackBtn }}
      </button>
      {{fas "chevron-right"}}
    {{/if}}{{ name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
  },
  onClickBack() {
    Radio.request('history', 'go:latestList');
  },
  templateContext() {
    return {
      hasLatestList: Radio.request('history', 'has:latestList'),
    };
  },
});

const FlowItemView = View.extend({
  className: 'card-list__item',
  template: FlowItemTemplate,
  templateContext() {
    return {
      ...getItemContext(this.model),
      published: !!this.model.get('published_at'),
    };
  },
  triggers: {
    'click': 'click',
  },
  onClick() {
    Radio.trigger('event-router', 'programFlow', this.model.id);
  },
});

const FlowListView = CollectionView.extend({
  className: 'card-list program-items__list',
  childView: FlowItemView,
  emptyView: EmptyView,
  emptyViewOptions: {
    text: i18n.flowsEmptyView,
  },
  viewComparator: 'name',
});

const LayoutView = View.extend({
  className: 'program-page__frame',
  template: LayoutTemplate,
  regions: {
    contextTrail: {
      el: '[data-context-trail-region]',
      replaceElement: true,
    },
    flows: {
      el: '[data-flows-region]',
      replaceElement: true,
    },
    standardActions: {
      el: '[data-standard-actions-region]',
      replaceElement: true,
    },
    automatedActions: {
      el: '[data-automated-actions-region]',
      replaceElement: true,
    },
    sidebar: '[data-sidebar-region]',
  },
  onRender() {
    this.showChildView('contextTrail', new ContextTrailView({ model: this.model }));
    this.showChildView('sidebar', new SidebarView({ model: this.model }));
    this.showChildView('flows', new FlowListView({ collection: this.getOption('flows') }));

    this.showChildView('standardActions', new ActionListView({
      collection: this.getOption('standardActions'),
      viewComparator: 'name',
      emptyText: i18n.standardActionsEmptyView,
    }));

    this.showChildView('automatedActions', new ActionListView({
      collection: this.getOption('automatedActions'),
      viewComparator: 'name',
      emptyText: i18n.automatedActionsEmptyView,
    }));
  },
});

export {
  LayoutView,
};
