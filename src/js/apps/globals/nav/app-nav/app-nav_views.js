import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import Droplist from 'js/components/droplist';

import intl from 'js/i18n';

import './app-nav.scss';

const i18n = intl.globals.appNav.appNavViews;

const MainNavDroplist = Droplist.extend({
  popWidth: '248px',
  position() {
    const { outerHeight } = this.getView().getBounds();

    return {
      top: outerHeight,
      left: 16,
    };
  },
  viewOptions: {
    tagName: 'div',
    className() {
      if (this.getOption('state').isMinimized) return 'app-nav__header minimized';
      return 'app-nav__header';
    },
    template: hbs`
      {{#if isMinimized}}
        <img class="app-nav__header-logo" src="/rwell-logo.svg" />
      {{else}}
        <div class="u-text--overflow">
          <h2 class="app-nav__header-title u-text--overflow">{{ workspaceName }}</h2>
          <span class="app-nav__header-arrow">{{far "angle-down"}}</span>
        </div>
        <div class="u-text--overflow">{{ userName }}</div>
      {{/if}}
    `,
    templateContext() {
      const currentUser = Radio.request('bootstrap', 'currentUser');
      const currentWorkspace = Radio.request('workspace', 'current');

      return {
        userName: currentUser.get('name'),
        workspaceName: currentWorkspace.get('name'),
        isMinimized: this.getOption('state').isMinimized,
      };
    },
  },
  picklistOptions() {
    return {
      className: 'picklist app-nav__picklist',
      template: hbs`
        <div class="app-nav__picklist-heading">{{ @intl.globals.appNav.appNavViews.mainNavDroplist.organizationHeading }}</div>
        <div class="app-nav__picklist-workspace-name js-picklist-item">{{ headingText }}</div>
        <div class="flex-region picklist__scroll">
          <div class="app-nav__picklist-heading">{{ @intl.globals.appNav.appNavViews.mainNavDroplist.workspacesHeading }}</div>
          <ul class="js-picklist-scroll"></ul>
          <div class="app-nav__picklist-bottom">
            {{#if infoText}}
            <a class="picklist__item app-nav__picklist-item js-picklist-item" href="{{ infoText }}" target="_blank">
              {{far "life-ring"}}<span>{{ @intl.globals.appNav.appNavViews.mainNavDroplist.help }}</span>
            </a>
            {{/if}}
            <a class="picklist__item app-nav__picklist-item js-picklist-item" href="/logout">
              {{fas "right-from-bracket"}}<span>{{ @intl.globals.appNav.appNavViews.mainNavDroplist.signOut }}</span>
            </a>
          </div>
        </div>
      `,
      headingText() {
        const currentOrg = Radio.request('bootstrap', 'organization');

        return currentOrg.get('name');
      },
      infoText() {
        const helpUrl = Radio.request('settings', 'get', 'help_url');

        return helpUrl ?? 'https://help.roundingwell.com/';
      },
      itemClassName: 'app-nav__picklist-item',
    };
  },
  picklistEvents: {
    'picklist:item:select': 'onSelect',
  },
  onSelect({ model }) {
    const currentWorkspace = Radio.request('workspace', 'current');

    if (model.id === currentWorkspace.id) return;

    model.get('onSelect')();
  },
});

const AdminToolsDroplist = Droplist.extend({
  popWidth: '248px',
  position() {
    const isMinimized = this.getOption('state').get('isMinimized');

    return {
      top: window.innerHeight - 16,
      left: !isMinimized ? 164 : 52,
    };
  },
  viewOptions: {
    tagName: 'div',
    className: 'flex flex-align-center app-nav__bottom-button',
    template: hbs`{{fas "ellipsis"}}{{#unless isMinimized}}<span class="u-text--overflow">{{ @intl.globals.appNav.appNavViews.adminToolsDroplist.adminTools }}</span>{{/unless}}`,
    templateContext() {
      return {
        isMinimized: this.getOption('state').get('isMinimized'),
      };
    },
  },
  picklistOptions() {
    return {
      className: 'picklist app-nav__picklist',
      itemClassName: 'flex flex-align-center app-nav__picklist-item',
      headingText: intl.globals.appNav.appNavViews.adminToolsDroplist.adminTools,
      lists: [{
        collection: this.collection,
        itemTemplate: hbs`
          {{fa icon.type icon.icon classes=icon.classes~}}
          <span>{{formatMessage text}}</span>
        `,
      }],
    };
  },
  picklistEvents: {
    'picklist:item:select': 'onSelect',
  },
  onSelect({ model }) {
    model.get('onSelect')();
  },
});

const BottomNavView = View.extend({
  className: 'app-nav__bottom',
  regions: {
    dashboards: {
      el: '[data-nav-dashboards-region]',
      replaceElement: true,
    },
    adminTools: {
      el: '[data-nav-admin-tools-region]',
      replaceElement: true,
    },
  },
  template: hbs`
    <div data-nav-dashboards-region></div>
    {{#if canPatientCreate}}
      <div class="flex flex-align-center app-nav__bottom-button js-add-patient">
        {{fas "circle-plus"}}{{#unless isMinimized}}<span class="u-text--overflow">{{ @intl.globals.appNav.appNavViews.appNavView.addPatient }}</span>{{/unless}}
      </div>
    {{/if}}
    <div data-nav-admin-tools-region></div>
    <div class="flex flex-align-center app-nav__bottom-button js-minimize-menu">
      {{#if isMinimized}}
        {{fas "square-caret-right"}}
      {{else}}
        {{fas "square-caret-left"}}<span class="u-text--overflow">{{ @intl.globals.appNav.appNavViews.appNavView.minimizeMenu }}</span>
      {{/if}}
    </div>
  `,
  templateContext() {
    return {
      canPatientCreate: this.getOption('canPatientCreate'),
    };
  },
});

const AppNavView = View.extend({
  className() {
    if (this.model.get('isMinimized')) return 'app-nav minimized';
    return 'app-nav';
  },
  regions: {
    navMain: {
      el: '[data-nav-main-region]',
      replaceElement: true,
    },
    navContent: '[data-nav-content-region]',
    bottomNavContent: {
      el: '[data-bottom-nav-content-region]',
      replaceElement: true,
    },
  },
  triggers: {
    'click .js-add-patient': 'click:addPatient',
    'click .js-minimize-menu': 'click:minimizeMenu',
  },
  template: hbs`
    <div data-nav-main-region></div>
    <div data-nav-content-region></div>
    <div data-bottom-nav-content-region></div>
  `,
  modelEvents: {
    'change:isMinimized': 'onToggleMinimized',
  },
  onToggleMinimized() {
    this.$el.toggleClass('minimized', this.model.get('isMinimized'));
  },
  removeSelected() {
    this.$('.is-selected').removeClass('is-selected');
  },
});

const NavItemView = View.extend({
  tagName: 'a',
  className: 'flex app-nav__link',
  template: hbs`
    <div class="flex flex-align-center app-nav__link-icons">
      {{#each icons}}
        {{fa this.type this.icon classes=this.classes~}}
      {{/each}}
    </div>
    {{#unless isMinimized}}<div class="u-margin--l-16 u-text--overflow">{{formatMessage text}}</div>{{/unless}}
  `,
  templateContext() {
    return {
      isMinimized: this.state.get('isMinimized'),
    };
  },
  triggers: {
    'click': 'click',
  },
  modelEvents: {
    'selected': 'onSelected',
  },
  initialize({ state }) {
    this.state = state;
  },
  onClick() {
    Radio.trigger('event-router', this.model.get('event'), ...this.model.get('eventArgs'));
  },
  onSelected() {
    this.$el.addClass('is-selected');
  },
});

const AppNavCollectionView = CollectionView.extend({
  childView: NavItemView,
  childViewOptions() {
    return {
      state: this.model,
    };
  },
});

const PatientsAppNav = View.extend({
  template: hbs`
    <h3 class="flex app-nav__search js-search">
      {{fas "magnifying-glass"}}{{#unless isMinimized}}<span class="u-text--overflow">{{ @intl.globals.appNav.appNavViews.patientsAppNav.searchTitle }}</span>{{/unless}}
    </h3>
    {{#unless isMinimized}}
      <h3 class="app-nav__title">{{ @intl.globals.appNav.appNavViews.patientsAppNav.worklistsTitle }}</h3>
    {{/unless}}
    <div data-worklists-region></div>
  `,
  regions: {
    worklists: '[data-worklists-region]',
  },
  triggers: {
    'click @ui.search': 'search',
  },
  ui: {
    search: '.js-search',
  },
  onSearchActive(isActive) {
    /* istanbul ignore if: No need to test safeguard */
    if (this.isDestroyed()) return;
    this.ui.search.toggleClass('is-active', isActive);
  },
});

export {
  AppNavView,
  AppNavCollectionView,
  MainNavDroplist,
  PatientsAppNav,
  AdminToolsDroplist,
  BottomNavView,
  NavItemView,
  i18n,
};
