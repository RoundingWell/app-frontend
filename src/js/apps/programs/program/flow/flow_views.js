import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import intl from 'js/i18n';

import { getItemContext, ActionListView } from 'js/apps/programs/shared/program_views';
import { SidebarView } from 'js/apps/programs/program/sidebar/sidebar-views';

import HeaderTemplate from './header.hbs';
import LayoutTemplate from './layout.hbs';

import 'js/apps/programs/shared/program-page.scss';
import './program-flow.scss';

const ContextTrailView = View.extend({
  className: 'program-page__context-trail program-page__context-trail--compact',
  template: hbs`
    {{#if hasLatestList}}
      <button class="js-back program-page__context-link" type="button">
        {{fas "chevron-left"}}{{ @intl.programs.program.flow.flowViews.contextBackBtn }}
      </button>
      {{fas "chevron-right"}}
    {{/if}}
    <button class="js-program program-page__context-link" type="button">{{ programName }}</button>{{fas "chevron-right"}}{{ name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
    'click .js-program': 'click:program',
  },
  onClickBack() {
    Radio.request('history', 'go:latestList');
  },
  onClickProgram() {
    Radio.trigger('event-router', 'program:details', this.getOption('program').id);
  },
  templateContext() {
    return {
      hasLatestList: Radio.request('history', 'has:latestList'),
      programName: this.getOption('program').get('name'),
    };
  },
});

const HeaderView = View.extend({
  className: 'program-flow__header',
  template: HeaderTemplate,
  templateContext() {
    return {
      ...getItemContext(this.model),
      published: !!this.model.get('published_at'),
    };
  },
});

const LayoutView = View.extend({
  className: 'program-page__frame',
  template: LayoutTemplate,
  regions: {
    contextTrail: {
      el: '[data-context-trail-region]',
      replaceElement: true,
    },
    header: '[data-header-region]',
    actionList: {
      el: '[data-action-list-region]',
      replaceElement: true,
    },
    sidebar: '[data-sidebar-region]',
  },
  onRender() {
    const program = this.getOption('program');

    this.showChildView('contextTrail', new ContextTrailView({ model: this.model, program }));
    this.showChildView('header', new HeaderView({ model: this.model }));
    this.showChildView('sidebar', new SidebarView({ model: program }));

    this.showChildView('actionList', new ActionListView({
      collection: this.getOption('actions'),
      emptyText: intl.programs.program.flow.flowViews.emptyView,
    }));
  },
});

export {
  LayoutView,
};
