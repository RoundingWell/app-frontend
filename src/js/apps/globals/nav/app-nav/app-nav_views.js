import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import BottomNavTemplate from './bottom-nav.hbs';
import LayoutTemplate from './layout.hbs';
import WorkspaceButtonTemplate from './workspace-button.hbs';
import WorkspaceMenuTemplate from './workspace-menu.hbs';

import './app-nav.scss';

const i18n = intl.globals.appNav.appNavViews;

function getAppNavModeClassNames(isMinimized, isFullNavVisible) {
  if (!isMinimized) return ['app-nav--expanded', 'is-full-nav-visible'];

  if (isFullNavVisible) {
    return ['is-minimized', 'app-nav--minimized', 'is-overlay-expanded', 'app-nav--overlay-expanded', 'is-full-nav-visible'];
  }

  return ['is-minimized', 'app-nav--minimized', 'app-nav--rail'];
}

function getAppNavClassName(model) {
  const isFullNavVisible = model.get('isFullNavVisible');
  const isMinimized = model.get('isMinimized');
  const isNarrow = model.get('isNarrow');
  const classes = ['app-nav', ...getAppNavModeClassNames(isMinimized, isFullNavVisible)];

  if (isNarrow) {
    classes.push('is-narrow');
    if (isFullNavVisible) classes.push('app-nav--narrow-overlay-expanded');
  }

  return classes.join(' ');
}

function getNavMenuButtonAttributes(label) {
  return {
    'aria-label': label,
    'type': 'button',
  };
}

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
    tagName: 'button',
    className: 'app-nav__header js-nav-menu',
    attributes() {
      return getNavMenuButtonAttributes(i18n.mainNavDroplist.workspaceMenu);
    },
    template: WorkspaceButtonTemplate,
    templateContext() {
      const currentUser = Radio.request('bootstrap', 'currentUser');
      const currentWorkspace = Radio.request('workspace', 'current');

      return {
        userName: currentUser.get('name'),
        workspaceName: currentWorkspace.get('name'),
      };
    },
  },
  picklistOptions() {
    return {
      className: 'picklist app-nav__picklist',
      template: WorkspaceMenuTemplate,
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

    Radio.trigger('event-router', model.get('event'));
  },
});

const AdminToolsDroplist = Droplist.extend({
  popWidth: '248px',
  position() {
    return this.getView().getBounds();
  },
  viewOptions: {
    tagName: 'button',
    className: 'flex flex-align-center app-nav__bottom-button js-nav-menu',
    attributes() {
      return getNavMenuButtonAttributes(i18n.adminToolsDroplist.adminTools);
    },
    template: hbs`{{fas "ellipsis"}}<span class="app-nav__label u-text--overflow">{{ @intl.globals.appNav.appNavViews.adminToolsDroplist.adminTools }}</span>`,
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
    Radio.trigger('event-router', model.get('event'));
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
  template: BottomNavTemplate,
  templateContext() {
    return {
      canPatientCreate: this.model.get('canPatientCreate'),
    };
  },
  ui: {
    addPatient: '.js-add-patient',
    minimizeMenu: '.js-minimize-menu',
  },
  events: {
    'click @ui.addPatient': 'onClickAddPatient',
    'click @ui.minimizeMenu': 'onClickMinimizeMenu',
    'pointerdown @ui.minimizeMenu': 'onPointerDownMinimizeMenu',
  },
  modelEvents: {
    'change:isFullNavVisible': 'updateMinimizeMenuLabel',
    'change:isMinimized': 'updateMinimizeMenuLabel',
    'change:isNarrow': 'updateMinimizeMenuLabel',
  },
  onRender() {
    this.updateMinimizeMenuLabel();
  },
  onClickAddPatient() {
    this.trigger('click:addPatient');
  },
  onClickMinimizeMenu(evt) {
    if (this._suppressNextMinimizeClick) {
      this._suppressNextMinimizeClick = false;
      evt.preventDefault();
      return;
    }

    this.trigger('click:minimizeMenu');
  },
  onPointerDownMinimizeMenu(evt) {
    if (evt.pointerType !== 'mouse' && evt.pointerType !== 'touch') return;
    if (evt.pointerType === 'mouse' && !this.model.get('isNarrow')) return;
    if (!this.model.get('isMinimized') || this.model.get('isFullNavVisible')) return;

    // Swallow the click that follows this pointer event so the drawer opens instead of
    // toggling the persisted minimize preference.
    this._suppressNextMinimizeClick = true;
    this.trigger('touch:open', evt);
  },
  getMinimizeMenuLabel() {
    const isMinimized = this.model.get('isMinimized');
    const isFullNavVisible = this.model.get('isFullNavVisible');

    // On a narrow nav the expanded drawer can't be pinned open, so the button
    // acts as a close rather than "keep open".
    if (isMinimized && isFullNavVisible) {
      return this.model.get('isNarrow') ? i18n.appNavView.closeMenu : i18n.appNavView.keepMenuOpen;
    }
    if (isMinimized) return i18n.appNavView.expandMenu;

    return i18n.appNavView.minimizeMenu;
  },
  updateMinimizeMenuLabel() {
    this.ui.minimizeMenu.attr('aria-label', this.getMinimizeMenuLabel());
  },
});

const AppNavView = View.extend({
  className() {
    return getAppNavClassName(this.model);
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
  events: {
    'focusin': 'onFocusIn',
    'focusout': 'onFocusOut',
    'pointerenter': 'onPointerEnter',
    'pointerleave': 'onPointerLeave',
  },
  template: LayoutTemplate,
  modelEvents: {
    'change:isFullNavVisible': 'updateDisplayState',
    'change:isMinimized': 'updateDisplayState',
    'change:isNarrow': 'updateDisplayState',
  },
  onRender() {
    this.updateDisplayState();
  },
  updateDisplayState() {
    this.$el.attr('class', getAppNavClassName(this.model));
  },
  onPointerEnter(evt) {
    this.trigger('pointer:enter', evt);
  },
  onPointerLeave(evt) {
    this.trigger('pointer:leave', evt);
  },
  onFocusIn(evt) {
    this.trigger('focus:in', evt);
  },
  onFocusOut(evt) {
    if (this.el.contains(evt.relatedTarget)) return;

    this.trigger('focus:out', evt);
  },
});

const NavItemView = View.extend({
  tagName: 'button',
  className: 'flex app-nav__link',
  attributes() {
    return {
      'aria-label': this.model.get('text'),
      'type': 'button',
    };
  },
  template: hbs`
    <span class="flex flex-align-center app-nav__link-icons">
      {{#each icons}}
        {{fa this.type this.icon classes=this.classes~}}
      {{/each}}
    </span>
    <span class="app-nav__label u-text--overflow">{{formatMessage text}}</span>
  `,
  triggers: {
    'click': 'click',
  },
  initialize({ state }) {
    this.state = state;
    this.listenTo(this.state, 'change:selectedNav', this.updateSelected);
  },
  onRender() {
    this.updateSelected();
  },
  onClick() {
    Radio.trigger('event-router', this.model.get('event'), ...this.model.get('eventArgs'));
  },
  updateSelected() {
    this.$el.toggleClass('is-selected', this.state.get('selectedNav') === this.model);
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
  className: 'app-nav__content',
  template: hbs`
    <button class="flex app-nav__search js-search" type="button" aria-label="{{ @intl.globals.appNav.appNavViews.patientsAppNav.searchTitle }}">
      {{fas "magnifying-glass"}}<span class="app-nav__label u-text--overflow">{{ @intl.globals.appNav.appNavViews.patientsAppNav.searchTitle }}</span>
    </button>
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
