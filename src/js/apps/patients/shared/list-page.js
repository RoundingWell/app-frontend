import { result } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';

import { renderTemplate } from 'js/i18n';
import { PHONE_QUERY } from 'js/utils/responsive';
import { bindSelectionModeViewport, getSelectedCount, unbindSelectionModeViewport } from 'js/apps/patients/shared/selection-mode';

import SelectionBarTemplate from './selection-bar.hbs';

import './patient-list-page.scss';

const FILTERS_SIDEBAR_FIXED_QUERY = '(width >= 2240px)';
const LIST_PAGE_UI = {
  filtersDrawerClose: '.js-close-sidebar-drawer',
  filtersSidebar: '.js-filters-sidebar',
};
const SelectionCountTemplate = hbs`{{formatMessage (intlGet "patients.shared.selectionMode.selected") itemCount=itemCount}}`;

const ListPageSelectionBarView = View.extend({
  className: 'patient-list-page__filters',
  template: SelectionBarTemplate,
  regions: {
    selectAll: '[data-select-all-region]',
    bulkEdit: '[data-bulk-edit-region]',
    count: '[data-count-region]',
  },
  ui: {
    cancel: '.js-selection-cancel',
    bulkEditOpen: '.js-bulk-edit-open',
    count: '.js-selection-count',
    start: '.js-selection-start',
  },
  events: {
    'click @ui.cancel': 'onClickCancel',
    'click @ui.bulkEditOpen': 'onClickBulkEditOpen',
    'click @ui.start': 'onClickStart',
  },
  modelEvents: {
    'change:isSelectionMode change:actionsSelected change:flowsSelected': 'syncSelectionMode',
  },
  initialize() {
    bindSelectionModeViewport(this);
  },
  onRender() {
    this.syncSelectionMode();
  },
  onBeforeDestroy() {
    unbindSelectionModeViewport(this);
  },
  syncSelectionMode() {
    const isSelectionMode = this.model.get('isSelectionMode');
    const itemCount = getSelectedCount(this.model);

    this.$el.toggleClass('is-selection-mode', isSelectionMode);
    this.$el.toggleClass('has-selection', itemCount > 0);
    this.ui.count.text(renderTemplate(SelectionCountTemplate, { itemCount }));
  },
  onClickStart() {
    this.model.enterSelectionMode();
  },
  onClickCancel() {
    this.model.exitSelectionMode();
    this.ui.start.trigger('focus');
  },
  onClickBulkEditOpen() {
    this.triggerMethod('bulk:open');
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
    this._isFiltersSidebarFixed = this.isFiltersSidebarFixed();
    const sidebarCollapsed = !this._isFiltersSidebarFixed
      && (this._isFiltersDrawer || this.model.get('filtersSidebarCollapsed'));

    this.layoutState = new Backbone.Model({
      filtersExpanded: !sidebarCollapsed,
      sidebarCollapsed,
      sidebarFixed: this._isFiltersSidebarFixed,
    });
    this.listenTo(this.layoutState, 'change:sidebarCollapsed', this.renderFiltersSidebarState);
    this.listenTo(Radio.channel('user-activity'), 'window:resize', this.onListPageWindowResize);
  },
  onRender() {
    const selectionBar = new ListPageSelectionBarView({ model: this.model });

    this.listenTo(selectionBar, 'bulk:open', () => this.triggerMethod('bulk:open'));
    this.showChildView('selectionBar', selectionBar);
    this.renderFiltersSidebarState();
  },
  showSelectionBarChildView(regionName, view) {
    this.getChildView('selectionBar').showChildView(regionName, view);
  },
  getSelectionBarRegion(regionName) {
    return this.getChildView('selectionBar').getRegion(regionName);
  },
  onChangeFiltersSidebarCollapsed() {
    const isCollapsed = !this._isFiltersSidebarFixed
      && (this._isFiltersDrawer || this.model.get('filtersSidebarCollapsed'));

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
    return window.matchMedia(PHONE_QUERY).matches;
  },
  isFiltersSidebarFixed() {
    return window.matchMedia(FILTERS_SIDEBAR_FIXED_QUERY).matches;
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
    this.$el.trigger('focus');
  },
  updateExpanded() {
    this.$el.attr('aria-expanded', String(this.layoutState.get('filtersExpanded')));
  },
  onRender() {
    this.updateExpanded();
    this.updateFixed();
  },
  updateFixed() {
    this.$el.prop('hidden', this.layoutState.get('sidebarFixed'));
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
      'change:filters-sidebar-fixed': this.onChangeFiltersSidebarFixed,
      'close:sidebar-drawer': this.onCloseSidebarDrawer,
      'bulk:open': this.onOpenBulkEdit,
    });
    this.setView(layoutView);

    if (layoutView.isFiltersSidebarFixed()) this.setSidebarCollapsed(false);
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
    const isCollapsed = !this.layoutView.isFiltersSidebarFixed()
      && (this.layoutView.isFiltersDrawer() || this.getState('filtersSidebarCollapsed'));

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
  onChangeFiltersSidebarFixed(isFixed) {
    if (isFixed) this.setSidebarCollapsed(false);
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
    const sidebarCollapsed = !this.layoutView.isFiltersSidebarFixed() && isCollapsed;

    this.layoutView.setSidebarLayoutState(sidebarCollapsed, !sidebarCollapsed && !this.isPatientSidebarOpen);
  },
  setFiltersSidebarDrawerMode(isDrawer) {
    if (this.isPatientSidebarOpen) return;

    this.getChildApp('filtersSidebar').getView().setDrawerMode(isDrawer);
  },
  listenToPatientSidebar() {
    const patientSidebar = this.getChildApp('patientSidebar');

    this.stopListening(patientSidebar, 'close');
    this.listenTo(patientSidebar, 'close', this.closePatientSidebar);
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
    if (this.layoutView.isFiltersSidebarFixed()) return;

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
