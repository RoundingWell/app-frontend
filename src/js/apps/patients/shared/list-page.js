import { result, some } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';

import SelectionBarTemplate from './selection-bar.hbs';

import './patient-list-page.scss';

const FILTER_DRAWER_QUERY = '(width <= 640px)';
const LIST_PAGE_UI = {
  filtersDrawerClose: '.js-close-sidebar-drawer',
  filtersSidebar: '.js-filters-sidebar',
};

const ListPageSelectionBarView = View.extend({
  className: 'patient-list-page__filters',
  template: SelectionBarTemplate,
  regions: {
    selectAll: '[data-select-all-region]',
    bulkEdit: '[data-bulk-edit-region]',
    count: '[data-count-region]',
  },
  modelEvents: {
    'change:actionsSelected change:flowsSelected change:listType': 'updateBulkEditingState',
  },
  onRender() {
    this.updateBulkEditingState();
  },
  updateBulkEditingState() {
    this.$el.toggleClass('is-bulk-editing', some(this.model.getSelectedList()));
  },
});

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
    const sidebarCollapsed = this._isFiltersDrawer || this.model.get('filtersSidebarCollapsed');

    this.layoutState = new Backbone.Model({
      filtersExpanded: !sidebarCollapsed,
      sidebarCollapsed,
    });
    this.listenTo(this.layoutState, 'change:sidebarCollapsed', this.renderFiltersSidebarState);
    this.listenTo(Radio.channel('user-activity'), 'window:resize', this.onListPageWindowResize);
  },
  onRender() {
    this.showChildView('selectionBar', new ListPageSelectionBarView({ model: this.model }));
    this.renderFiltersSidebarState();
  },
  showSelectionBarChildView(regionName, view) {
    this.getChildView('selectionBar').showChildView(regionName, view);
  },
  getSelectionBarRegion(regionName) {
    return this.getChildView('selectionBar').getRegion(regionName);
  },
  onChangeFiltersSidebarCollapsed() {
    const isCollapsed = this._isFiltersDrawer || this.model.get('filtersSidebarCollapsed');

    this.setSidebarLayoutState(isCollapsed, !isCollapsed);
  },
  setSidebarLayoutState(isCollapsed, filtersExpanded) {
    this.layoutState.set({
      filtersExpanded,
      sidebarCollapsed: isCollapsed,
    });
  },
  renderFiltersSidebarState() {
    const isCollapsed = this.isFiltersSidebarCollapsed();

    this.$el.toggleClass('is-filters-collapsed', isCollapsed);
    this.ui.filtersSidebar.attr('aria-hidden', String(isCollapsed));
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
  focusFiltersDrawer() {
    this.ui.filtersDrawerClose.trigger('focus');
  },
  setDrawerCloseHidden(isHidden) {
    this.ui.filtersDrawerClose.prop('hidden', isHidden);
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

    if (isFiltersDrawer === this._isFiltersDrawer) return;

    this._isFiltersDrawer = isFiltersDrawer;
    this.triggerMethod('change:filters-drawer', isFiltersDrawer);
  },
});

const ListPageFiltersButtonView = View.extend({
  tagName: 'button',
  className: 'button button--link patient-list-page__all-filters-button',
  initialize() {
    this.layoutState = this.getOption('layoutState');
    this.listenTo(this.layoutState, 'change:filtersExpanded', this.updateExpanded);
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
    this.$el.trigger('focus');
  },
  updateExpanded() {
    this.$el.attr('aria-expanded', String(this.layoutState.get('filtersExpanded')));
  },
  onRender() {
    this.updateExpanded();
  },
  template: hbs`<span class="patient-list-page__all-filters-icon">{{far "bars-filter" classes="patient-list-page__all-filters-glyph"}}</span>{{#if filtersCount}}<span class="patient-list-page__active-filter-dot" aria-hidden="true"></span>{{/if}}`,
  triggers: {
    'click': 'click',
  },
  modelEvents: {
    'change:filtersCount': 'render',
  },
});

const ListPageAppMixin = {
  setListPageView(layoutView) {
    this.layoutView = layoutView;
    this.listenTo(layoutView, {
      'change:filters-drawer': this.onChangeFiltersDrawer,
      'close:sidebar-drawer': this.onCloseSidebarDrawer,
    });
    this.setView(layoutView);
  },
  showSelectionBarChildView(regionName, view) {
    this.layoutView.showSelectionBarChildView(regionName, view);
  },
  getSelectionBarRegion(regionName) {
    return this.layoutView.getSelectionBarRegion(regionName);
  },
  onClickFiltersButton() {
    if (this.isPatientSidebarOpen) {
      this.showFiltersSidebar();
      return;
    }

    this.toggleFiltersSidebar();
  },
  restoreFiltersSidebarLayout() {
    this.layoutView.setDrawerCloseHidden(false);
    const isCollapsed = this.layoutView.isFiltersDrawer() || this.getState('filtersSidebarCollapsed');

    this.setSidebarLayoutCollapsed(isCollapsed);
  },
  onChangeFiltersDrawer(isFiltersDrawer) {
    if (isFiltersDrawer) {
      if (this.isPatientSidebarOpen) this.showFiltersSidebar();
      this.setFiltersSidebarDrawerMode(true);
      this.setSidebarLayoutCollapsed(true);
      return;
    }

    this.setFiltersSidebarDrawerMode(false);
    this.setSidebarLayoutCollapsed(this.isPatientSidebarOpen ? false : this.getState('filtersSidebarCollapsed'));
  },
  onCloseSidebarDrawer() {
    const wasPatientSidebarOpen = this.isPatientSidebarOpen;

    if (wasPatientSidebarOpen) this.showFiltersSidebar();
    this.setSidebarLayoutCollapsed(true);
    if (wasPatientSidebarOpen) {
      this.focusPatientSidebarTrigger();
    } else {
      this.getChildView('filters').focus();
    }
  },
  setSidebarLayoutCollapsed(isCollapsed) {
    this.layoutView.setSidebarLayoutState(isCollapsed, !isCollapsed && !this.isPatientSidebarOpen);
  },
  setFiltersSidebarDrawerMode(isDrawer) {
    if (this.isPatientSidebarOpen) return;

    this.getChildApp('filtersSidebar').getView().setDrawerMode(isDrawer);
  },
  closePatientSidebar() {
    this.showFiltersSidebar();
    this.focusPatientSidebarTrigger();
  },
  focusPatientSidebar(patientSidebar) {
    this.layoutView.setDrawerCloseHidden(true);
    if (!this.layoutView.isFiltersDrawer()) return;

    patientSidebar.focusClose();
    this.listenToOnce(patientSidebar, 'sync:data', () => patientSidebar.focusClose());
  },
  focusPatientSidebarTrigger() {
    const trigger = this.patientSidebarTrigger;

    this.patientSidebarTrigger = null;
    trigger.focus();
  },
  setSidebarCollapsed(isCollapsed) {
    this.getState().setFiltersSidebarCollapsed(isCollapsed);
    this.setSidebarLayoutCollapsed(isCollapsed);
  },
  toggleFiltersSidebar() {
    const isFiltersDrawer = this.layoutView.isFiltersDrawer();
    const isCollapsed = isFiltersDrawer ?
      this.layoutView.isFiltersSidebarCollapsed() :
      this.getState('filtersSidebarCollapsed');
    const nextIsCollapsed = !isCollapsed;

    if (isFiltersDrawer) {
      this.setSidebarLayoutCollapsed(false);
      this.layoutView.focusFiltersDrawer();
    } else {
      this.setSidebarCollapsed(nextIsCollapsed);
    }

    if (isCollapsed) this.getFiltersState().trigger('expand:sections');
  },
};

export {
  ListPageAppMixin,
  ListPageFiltersButtonView,
  ListPageView,
};
