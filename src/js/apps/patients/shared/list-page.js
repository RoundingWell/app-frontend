import { result } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';

import './patient-list-page.scss';

const FILTER_DRAWER_QUERY = '(width <= 640px)';
const FILTERS_SIDEBAR_FIXED_QUERY = '(width >= 2240px)';
const LIST_PAGE_UI = {
  filtersDrawerClose: '.js-close-sidebar-drawer',
  filtersSidebar: '.js-filters-sidebar',
};

const ListPageView = View.extend({
  className: 'flex-region list-page',
  events: {
    'click @ui.filtersDrawerClose': 'onClickCloseSidebarDrawer',
    'keydown': 'onListPageKeydown',
  },
  ui() {
    return {
      ...LIST_PAGE_UI,
      ...result(this, 'pageUi'),
    };
  },
  initialize() {
    this._isFiltersDrawer = this.isFiltersDrawer();
    this._isFiltersSidebarFixed = this.isFiltersSidebarFixed();
    const sidebarCollapsed = !this._isFiltersSidebarFixed
      && (this._isFiltersDrawer || this.model.get('filtersSidebarCollapsed'));

    this.layoutState = new Backbone.Model({
      sidebarContent: 'filters',
      filtersExpanded: !sidebarCollapsed,
      sidebarCollapsed,
      sidebarFixed: this._isFiltersSidebarFixed,
    });
    this.listenTo(this.layoutState, 'change:sidebarCollapsed', this.renderFiltersSidebarState);
    this.listenTo(Radio.channel('user-activity'), 'window:resize', this.onListPageWindowResize);
  },
  onRender() {
    this.renderFiltersSidebarState();
  },
  onChangeFiltersSidebarCollapsed() {
    const isCollapsed = !this._isFiltersSidebarFixed
      && (this._isFiltersDrawer || this.model.get('filtersSidebarCollapsed'));

    this.setSidebarCollapsed(isCollapsed);
  },
  setSidebarCollapsed(isCollapsed) {
    const collapsed = !this.isFiltersSidebarFixed() && isCollapsed;
    this.setSidebarLayoutState(collapsed, !collapsed && this.layoutState.get('sidebarContent') === 'filters');
  },
  showPatientSidebar() {
    this.layoutState.set('sidebarContent', 'patient');
    this.setSidebarCollapsed(false);
  },
  showFiltersSidebar() {
    this.layoutState.set('sidebarContent', 'filters');
    this.setDrawerCloseHidden(false);
    this.setSidebarCollapsed(this.isFiltersDrawer() || this.model.get('filtersSidebarCollapsed'));
  },
  toggleFiltersSidebar() {
    const isDrawer = this.isFiltersDrawer();
    const isCollapsed = isDrawer ? this.isFiltersSidebarCollapsed() : this.model.get('filtersSidebarCollapsed');
    if (isDrawer) {
      this.setSidebarCollapsed(false);
      this.focusFiltersDrawer();
    } else {
      this.model.setFiltersSidebarCollapsed(!isCollapsed);
      this.setSidebarCollapsed(!isCollapsed);
    }
    return isCollapsed;
  },
  setSidebarLayoutState(isCollapsed, filtersExpanded) {
    this.layoutState.set({
      filtersExpanded,
      sidebarCollapsed: isCollapsed,
    });
  },
  renderFiltersSidebarState() {
    const isCollapsed = this.isFiltersSidebarCollapsed();

    this.el.classList.toggle('is-filters-collapsed', isCollapsed);
    this.getUI('filtersSidebar')[0].setAttribute('aria-hidden', String(isCollapsed));
  },
  isFiltersSidebarCollapsed() {
    return this.layoutState.get('sidebarCollapsed');
  },
  getLayoutState() {
    return this.layoutState;
  },
  isFiltersDrawer() {
    return window.matchMedia(FILTER_DRAWER_QUERY).matches;
  },
  isFiltersSidebarFixed() {
    return window.matchMedia(FILTERS_SIDEBAR_FIXED_QUERY).matches;
  },
  focusFiltersDrawer() {
    this.getUI('filtersDrawerClose')[0].focus();
  },
  setDrawerCloseHidden(isHidden) {
    this.getUI('filtersDrawerClose')[0].hidden = isHidden;
  },
  onClickCloseSidebarDrawer() {
    this.triggerMethod('close:sidebar-drawer');
  },
  onListPageKeydown(event) {
    if (event.key !== 'Escape' || !this.isFiltersDrawer() || this.isFiltersSidebarCollapsed()) return;

    event.preventDefault();
    this.triggerMethod('close:sidebar-drawer');
  },
  onListPageWindowResize() {
    const isFiltersDrawer = this.isFiltersDrawer();
    const isFiltersSidebarFixed = this.isFiltersSidebarFixed();

    if (
      isFiltersDrawer === this._isFiltersDrawer
      && isFiltersSidebarFixed === this._isFiltersSidebarFixed
    ) return;

    const filtersDrawerChanged = isFiltersDrawer !== this._isFiltersDrawer;
    const filtersSidebarFixedChanged = isFiltersSidebarFixed !== this._isFiltersSidebarFixed;
    this._isFiltersDrawer = isFiltersDrawer;
    this._isFiltersSidebarFixed = isFiltersSidebarFixed;
    this.layoutState.set('sidebarFixed', isFiltersSidebarFixed);

    if (filtersDrawerChanged) this.triggerMethod('change:filters-drawer', isFiltersDrawer);
    if (filtersSidebarFixedChanged) this.triggerMethod('change:filters-sidebar-fixed', isFiltersSidebarFixed);
  },
});

const ListPageFiltersButtonView = View.extend({
  tagName: 'button',
  className: 'button button--link patient-list-page__all-filters-button',
  initialize() {
    this.layoutState = this.getOption('layoutState');
    this.listenTo(this.layoutState, {
      'change:filtersExpanded': this.updateExpanded,
      'change:sidebarFixed': this.updateFixed,
    });
  },
  attributes() {
    return {
      'aria-controls': this.controlsId,
      'aria-expanded': String(this.getOption('layoutState').get('filtersExpanded')),
      'aria-label': this.label,
      'title': this.label,
      'type': 'button',
    };
  },
  focus() {
    this.el.focus();
  },
  updateExpanded() {
    this.el.setAttribute('aria-expanded', String(this.layoutState.get('filtersExpanded')));
  },
  onRender() {
    this.updateExpanded();
    this.updateFixed();
  },
  updateFixed() {
    this.el.hidden = this.layoutState.get('sidebarFixed');
  },
  template: hbs`<span class="patient-list-page__all-filters-icon">{{far "bars-filter" classes="patient-list-page__all-filters-glyph"}}</span>{{#if filtersCount}}<span class="patient-list-page__active-filter-dot" aria-hidden="true"></span>{{/if}}`,
  triggers: {
    'click': 'click',
  },
  modelEvents: {
    'change:filtersCount': 'render',
  },
});

export {
  ListPageFiltersButtonView,
  ListPageView,
};
