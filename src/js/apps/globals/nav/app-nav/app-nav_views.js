import { animate, cubicBezier } from 'animejs';
import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import BottomNavTemplate from './bottom-nav.hbs';
import LayoutTemplate from './layout.hbs';
import WorkspaceButtonTemplate from './workspace-button.hbs';
import WorkspaceMenuTemplate from './workspace-menu.hbs';

import './app-nav.scss';

const i18n = intl.globals.appNav.appNavViews;

// Chrome 156 EASE_IN_OUT_EMPHASIZED is two joined cubic Beziers, not
// a single CSS cubic-bezier. Normalize each segment for Anime.js.
// https://chromium.googlesource.com/chromium/src/+/refs/tags/156.0.8078.49/ui/gfx/animation/tween.cc#48
const HOVER_OPEN_DURATION = 180;
const HOVER_CLOSE_DURATION = 120;
const splitX = 0.166666;
const splitY = 0.4;
const first = cubicBezier(0.05 / splitX, 0, 0.133333 / splitX, 0.06 / splitY);
const second = cubicBezier((0.208333 - splitX) / (1 - splitX), (0.82 - splitY) / (1 - splitY), (0.25 - splitX) / (1 - splitX), 1);
const hoverEase = t => t < splitX ?
  splitY * first(t / splitX) :
  splitY + (1 - splitY) * second((t - splitX) / (1 - splitX));

function getAppNavClassName(model) {
  const isFullNavVisible = model.get('isFullNavVisible');
  const isMinimized = model.get('isMinimized');
  const isNarrow = model.get('isNarrow');
  const classes = ['app-nav'];

  if (isMinimized) classes.push('app-nav--minimized');
  if (isFullNavVisible) classes.push('is-full-nav-visible');
  if (isNarrow) classes.push('is-narrow');

  return classes.join(' ');
}

function getNavMenuButtonAttributes(label) {
  return {
    'aria-label': label,
    'type': 'button',
  };
}

const MainNavDroplist = Droplist.extend({
  popWidth: 248,
  position() {
    const { outerHeight } = this.getBounds();

    return {
      top: outerHeight,
      left: 16,
    };
  },
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
  onPicklistSelect({ model }) {
    this.popRegion.empty();

    if (model.get('event') === 'whats-new') return;

    this.getState().set('selected', model);
  },
  onSelect({ model }) {
    if (model.get('event') === 'whats-new') {
      this.trigger('show:whatsNew');
      return;
    }

    const currentWorkspace = Radio.request('workspace', 'current');

    if (model.id === currentWorkspace.id) return;

    Radio.trigger('event-router', model.get('event'));
  },
});

const AdminToolsDroplist = Droplist.extend({
  popWidth: 248,
  tagName: 'button',
  className: 'flex flex-align-center app-nav__bottom-button js-nav-menu',
  attributes() {
    return getNavMenuButtonAttributes(i18n.adminToolsDroplist.adminTools);
  },
  template: hbs`{{fas "ellipsis"}}<span class="app-nav__label u-text--overflow">{{ @intl.globals.appNav.appNavViews.adminToolsDroplist.adminTools }}</span>`,
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
    announcement: {
      el: '[data-nav-announcement-region]',
      replaceElement: true,
    },
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
  onClickMinimizeMenu() {
    this.trigger('click:minimizeMenu');
  },
  getMinimizeMenuLabel() {
    const isMinimized = this.model.get('isMinimized');
    const isFullNavVisible = this.model.get('isFullNavVisible');

    if (!isMinimized) return i18n.appNavView.minimizeMenu;

    // The wide-screen control pins the menu regardless of transient reveal.
    if (!this.model.get('isNarrow')) return i18n.appNavView.keepMenuOpen;

    return isFullNavVisible ? i18n.appNavView.closeMenu : i18n.appNavView.expandMenu;
  },
  updateMinimizeMenuLabel() {
    this.ui.minimizeMenu[0].setAttribute('aria-label', this.getMinimizeMenuLabel());
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
    'focusin': 'onDomFocusIn',
    'focusout': 'onDomFocusOut',
    'pointerover': 'onDomPointerEnter',
    'pointerout': 'onDomPointerLeave',
    'pointerdown': 'onDomPointerDown',
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
    const width = this.el.getBoundingClientRect().width;
    const announcementOpacity = this.el.style.getPropertyValue('--app-nav-announcement-opacity');
    this.finishHoverMotion();
    if (!this._animateHover || !this.model.get('isMinimized') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const opening = this.model.get('isFullNavVisible');
    const targetOpacity = Number(opening);
    const style = getComputedStyle(this.el);
    const targetWidth = parseFloat(style.getPropertyValue(opening ? '--app-nav-width' : '--app-nav-rail-width'));
    this.el.classList.add('is-hover-motion');
    this.el.style.width = `${ width }px`;
    this._hoverAnimation = animate(this.el, {
      'width': targetWidth,
      '--app-nav-announcement-opacity': [announcementOpacity || (1 - targetOpacity), targetOpacity],
      'duration': opening ? HOVER_OPEN_DURATION : HOVER_CLOSE_DURATION,
      'ease': hoverEase,
      'onComplete': () => this.finishHoverMotion(),
    });
  },
  setHovering(isHovering) {
    this._animateHover = true;
    this.model.set('isHovering', isHovering);
    this._animateHover = false;
  },
  preparePointerInteraction() {
    // Keep a closing button under the pointer through native mouseup/click.
    if (this._hoverAnimation && !this.model.get('isFullNavVisible')) {
      this.model.set('isHovering', true);
    }
    this.finishHoverMotion();
  },
  finishHoverMotion() {
    this._hoverAnimation?.cancel();
    this._hoverAnimation = null;
    this.el.style.removeProperty('width');
    this.el.style.removeProperty('--app-nav-announcement-opacity');
    this.el.className = getAppNavClassName(this.model);
  },
  onBeforeDestroy() {
    this.finishHoverMotion();
  },
  onDomPointerDown(evt) {
    this._pointerFocusTarget = evt.target;
    this.triggerMethod('pointer:down', evt);
  },
  onDomPointerEnter(evt) {
    if (this.el.contains(evt.relatedTarget)) return;

    this.triggerMethod('pointer:enter', evt);
  },
  onDomPointerLeave(evt) {
    if (this.el.contains(evt.relatedTarget)) return;

    this.triggerMethod('pointer:leave', evt);
  },
  onDomFocusIn(evt) {
    const isPointerFocus = evt.target.contains(this._pointerFocusTarget);
    this._pointerFocusTarget = null;
    if (isPointerFocus) return;

    this.triggerMethod('focus:in', evt);
  },
  onDomFocusOut(evt) {
    if (!evt.relatedTarget?.contains(this._pointerFocusTarget)) this._pointerFocusTarget = null;
    if (this.el.contains(evt.relatedTarget)) return;

    this.triggerMethod('focus:out', evt);
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
    this.el.classList.toggle('is-selected', this.state.get('selectedNav') === this.model);
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
    this.ui.search[0].classList.toggle('is-active', isActive);
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
