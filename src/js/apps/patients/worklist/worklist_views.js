import { every, debounce } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';
import 'scss/modules/card-list.scss';
import 'scss/modules/skeleton.scss';

import intl from 'js/i18n';
import underscored from 'js/utils/formatting/underscored';
import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import PreloadRegion from 'js/regions/preload_region';

import Droplist from 'js/components/droplist';

import { ListPageFiltersButtonView, ListPageView } from 'js/apps/patients/shared/list-page';
import { TitleOwnerDroplist } from 'js/apps/patients/shared/list_views';
import SharedSelectAllView from 'js/apps/patients/shared/components/select-all_view';
import { ActionEmptyView, ActionItemView } from './action_views';
import { FlowEmptyView, FlowItemView } from './flow_views';
import LayoutTemplate from './layout.hbs';
import ListLoadingTemplate from './list-loading.hbs';
import SidebarControlsTemplate from './sidebar-controls.hbs';

import 'scss/domain/work-card.scss';
import 'scss/domain/action-card.scss';
import 'scss/domain/flow-card.scss';
import 'scss/domain/patient-list.scss';
import './worklist-list.scss';

const i18n = intl.patients.worklist.worklistViews;

const SelectAllView = SharedSelectAllView.extend({
  className: 'button button--checkbox worklist-list__select-all',
});

const LayoutView = ListPageView.extend({
  className: 'flex-region list-page patient-list-page worklist-list-page',
  template: LayoutTemplate,
  regions: {
    dateFilter: '[data-date-filter-region]',
    filters: '[data-filters-region]',
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
    selectionBar: '[data-selection-bar-region]',
    title: {
      el: '[data-title-region]',
      replaceElement: true,
    },
    search: '[data-search-region]',
    listStatus: '[data-list-status-region]',
    filtersSidebar: {
      el: '[data-filters-sidebar-region]',
      regionClass: PreloadRegion,
    },
  },
  modelEvents: {
    'change:filtersSidebarCollapsed': 'onChangeFiltersSidebarCollapsed',
  },
  triggers: {
    'click @ui.select': 'click:select',
  },
  pageUi: {
    select: '.js-select',
  },
});

const SidebarControlsView = View.extend({
  className: 'worklist-list__sidebar-controls',
  template: SidebarControlsTemplate,
  regions: {
    sort: '[data-sort-region]',
    toggle: '[data-toggle-region]',
    ownerToggle: '[data-owner-toggle-region]',
  },
});

const TypeToggleView = View.extend({
  className: 'worklist-list__type-toggle',
  template: hbs`
    <button class="button worklist-list__sidebar-button js-toggle-actions" type="button" aria-pressed="{{ actionsPressed }}">{{far "file-lines"}}<span>{{ @intl.patients.worklist.worklistViews.typeToggleView.actionsButton }}</span></button>{{~ remove_whitespace ~}}
    <button class="button worklist-list__sidebar-button js-toggle-flows" type="button" aria-pressed="{{ flowsPressed }}">{{far "folder"}}<span>{{ @intl.patients.worklist.worklistViews.typeToggleView.flowsButton }}</span></button>
  `,
  templateContext() {
    const isFlowList = this.getOption('isFlowList');

    return {
      actionsPressed: String(!isFlowList),
      flowsPressed: String(isFlowList),
    };
  },
  triggers: {
    'click .js-toggle-actions': 'click:toggleActions',
    'click .js-toggle-flows': 'click:toggleFlows',
  },
  ui: {
    buttons: 'button',
  },
  onClickToggleActions() {
    this.triggerMethod('toggle:listType', 'actions');
  },
  onClickToggleFlows() {
    this.triggerMethod('toggle:listType', 'flows');
  },
});

const NoOwnerToggleView = View.extend({
  className: 'worklist-list__owner-toggle',
  template: hbs`
    <button class="button worklist-list__sidebar-button worklist-list__owner-toggle-button" type="button" aria-pressed="{{ noOwner }}">
      {{ @intl.patients.worklist.worklistViews.noOwnerToggleView.noOwner }}{{#if noOwner}}{{far "xmark" classes="worklist-list__owner-toggle-icon"}}{{/if}}
    </button>
  `,
  triggers: {
    click: 'click',
  },
});

const worklistIcons = {
  'owned-by': [{ icon: 'user', classes: 'list-page__title-glyph worklist-list__title-glyph' }],
  'shared-by': [{ icon: 'users', classes: 'list-page__title-glyph worklist-list__title-glyph' }],
  'new-past-day': [
    { icon: 'angle-left', classes: 'list-page__title-glyph worklist-list__title-glyph worklist-list__title-glyph--back' },
    { icon: '1', classes: 'list-page__title-glyph worklist-list__title-glyph worklist-list__title-glyph--one' },
  ],
  'updated-past-three-days': [
    { icon: 'angle-left', classes: 'list-page__title-glyph worklist-list__title-glyph worklist-list__title-glyph--back' },
    { icon: '3', classes: 'list-page__title-glyph worklist-list__title-glyph worklist-list__title-glyph--three' },
  ],
  'done-last-thirty-days': [
    { icon: '3', classes: 'list-page__title-glyph worklist-list__title-glyph worklist-list__title-glyph--three' },
    { icon: '0', classes: 'list-page__title-glyph worklist-list__title-glyph worklist-list__title-glyph--zero' },
  ],
};

const TitleLabelView = View.extend({
  className: 'u-text--nowrap',
  getTemplate() {
    if (this.getOption('owner')) {
      return hbs`{{formatMessage (intlGet "patients.worklist.worklistViews.listTitleLabelView.listTitles") title=worklistId owner=owner}}`;
    }
    return hbs`{{formatMessage (intlGet "patients.worklist.worklistViews.listTitleLabelView.listLabels") title=worklistId}}`;
  },
  templateContext() {
    return {
      owner: this.getOption('owner'),
      worklistId: underscored(this.getOption('worklistId')),
    };
  },
});

const ListTitleView = View.extend({
  regions: {
    label: '[data-label-region]',
    owner: '[data-owner-filter-region]',
  },
  className: 'flex list-page__title-content',
  template: hbs`
    <span class="list-page__title-icon worklist-list__title-icon">
      {{#each icons}}
        {{far icon classes=classes}}
      {{/each}}
    </span>
    <div data-label-region></div>
    <div data-owner-filter-region></div>
  `,
  templateContext() {
    return {
      owner: this.owner.get('name'),
      worklistId: underscored(this.model.id),
      icons: worklistIcons[this.model.id],
    };
  },
  initialize() {
    const currentClinician = Radio.request('bootstrap', 'currentUser');
    this.canViewAssignedActions = currentClinician.can('app:worklist:clinician_filter');
    this.shouldShowTeam = this.model.id !== 'owned-by';
    this.shouldShowClinician = this.model.id !== 'shared-by';
    this.shouldShowDroplist = (this.shouldShowClinician && this.canViewAssignedActions) || this.shouldShowTeam;
    this.owner = this.model.getOwner();
  },
  onRender() {
    this.showLabel();
    this.showOwnerDroplist();
  },
  showLabel() {
    const titleLabelView = new TitleLabelView({
      owner: this.shouldShowDroplist ? null : this.owner.get('name'),
      worklistId: this.model.id,
    });

    this.showChildView('label', titleLabelView);
  },
  showOwnerDroplist() {
    if (!this.shouldShowDroplist) return;

    const ownerI18n = i18n.titleOwnerDroplist;

    const ownerDroplistView = new TitleOwnerDroplist({
      owner: this.owner,
      hasClinicians: this.shouldShowClinician && this.canViewAssignedActions,
      hasTeams: this.shouldShowTeam,
      hasCurrentClinician: this.shouldShowClinician,
      headingText: this.shouldShowClinician ? ownerI18n.ownerFilterHeadingText : ownerI18n.teamsFilterHeadingText,
      placeholderText: this.shouldShowClinician ? ownerI18n.ownerFilterPlaceholderText : ownerI18n.teamsFilterPlaceholderText,
    });

    this.listenTo(ownerDroplistView, 'change:owner', owner => {
      this.triggerMethod('change:owner', owner);
    });

    this.showChildView('owner', ownerDroplistView);
  },
});

const AllFiltersButtonView = ListPageFiltersButtonView.extend({
  controlsId: 'worklist-list-sidebar',
  label: i18n.allFiltersButtonView.allFiltersButton,
});

const EmptyFindInListView = View.extend({
  className: 'card-list__empty',
  template: hbs`<h2>{{ @intl.patients.worklist.worklistViews.emptyFindInListView.noResults }}</h2>`,
});

const CountLoadingView = View.extend({
  className: 'worklist-list__count-skeleton skeleton-loading',
  attributes: {
    'aria-hidden': 'true',
  },
  template: hbs`<span class="skeleton-loading__shape worklist-list__count-skeleton-shape"></span>`,
});

const ListLoadingView = View.extend({
  className: 'card-list worklist-list__skeleton skeleton-loading',
  attributes() {
    return {
      'aria-busy': 'true',
      'aria-label': this.getLoadingText(),
      'role': 'status',
    };
  },
  template: ListLoadingTemplate,
  getLoadingText() {
    return this.getOption('isFlowList') ? i18n.loadingView.loadingFlows : i18n.loadingView.loadingActions;
  },
  templateContext() {
    return {
      items: new Array(3).fill(null),
      isFlowList: this.getOption('isFlowList'),
    };
  },
});

const ListUpdatingView = View.extend({
  className: 'worklist-list__updating',
  attributes: {
    'aria-live': 'polite',
    'role': 'status',
  },
  template: hbs`{{ loadingText }}`,
  templateContext() {
    const loadingViewI18n = i18n.loadingView;
    const loadingText = this.getOption('isFlowList') ? loadingViewI18n.updatingFlows : loadingViewI18n.updatingActions;

    return { loadingText };
  },
});

const ListErrorView = View.extend({
  className: 'worklist-list__error',
  attributes: {
    'role': 'alert',
  },
  template: hbs`
    <span>{{ message }}</span>
    <button class="button button--text js-retry" type="button">{{ @intl.patients.worklist.worklistViews.loadingView.retry }}</button>
  `,
  triggers: {
    'click .js-retry': 'retry',
  },
  templateContext() {
    const loadingViewI18n = i18n.loadingView;
    const message = this.getOption('isRefresh') ? loadingViewI18n.updateError : loadingViewI18n.loadError;

    return { message };
  },
});

const ListView = CollectionView.extend({
  className: 'card-list list-page__list worklist-list__list',
  attributes: {
    'role': 'list',
    'aria-busy': 'false',
  },
  childView() {
    return this.isFlowList ? FlowItemView : ActionItemView;
  },
  emptyView() {
    if (this.collection.length && this.state.get('searchQuery')) {
      return EmptyFindInListView;
    }

    return this.isFlowList ? FlowEmptyView : ActionEmptyView;
  },
  childViewOptions() {
    return {
      state: this.state,
      selectedPatientId: this.selectedPatientId,
    };
  },
  childViewTriggers: {
    'render': 'listItem:render',
    'change:canEdit': 'listItem:canEdit',
    'select': 'select',
    'click:patient': 'click:patient',
  },
  onListItemRender(view) {
    view.searchString = view.$el.text();
  },
  onListItemCanEdit() {
    // NOTE: debounced in initialize
    this.triggerMethod('change:canEdit');
  },
  initialize({ state, editableCollection, selectedPatientId }) {
    this.state = state;
    this.editableCollection = editableCollection;
    this.isFlowList = state.isFlowType();
    this.selectedPatientId = selectedPatientId;

    this.onListItemCanEdit = debounce(this.onListItemCanEdit, 60);

    this.listenTo(state, 'change:searchQuery', this.searchList);
  },
  onAttach() {
    this.searchList(null, this.state.get('searchQuery'));
  },
  setPatientSelected(patientId) {
    this.selectedPatientId = patientId;
    this.children.each(view => view.setPatientSelected(patientId));
  },
  /* istanbul ignore next: future proof */
  onRenderChildren() {
    if (!this.isAttached()) return;
    this.triggerMethod('filtered', this.children.map('model'));
  },
  onSelect(selectedView, isShiftKeyPressed) {
    this.state.selectRange(this.editableCollection, selectedView.model, isShiftKeyPressed);
  },
  setLoading(isLoading) {
    this.$el
      .attr('aria-busy', String(isLoading))
      .toggleClass('is-loading', isLoading);
  },
  searchList(state, searchQuery) {
    if (!searchQuery) {
      this.removeFilter();
      return;
    }

    const matchers = buildMatchersArray(searchQuery);

    this.setFilter(function({ searchString }) {
      return every(matchers, function(matcher) {
        return matcher.test(searchString);
      });
    });
  },
});

const SortDroplist = Droplist.extend({
  align: 'right',
  popWidth: 248,
  picklistOptions: {
    headingText: i18n.sortDroplist.headingText,
  },
  viewOptions: {
    className: 'button worklist-list__sidebar-button',
    template: hbs`{{far "arrow-down-arrow-up" classes="worklist-list__sort-icon"}}{{ text }}`,
  },
});

export {
  LayoutView,
  ListTitleView,
  AllFiltersButtonView,
  SelectAllView,
  CountLoadingView,
  ListErrorView,
  ListLoadingView,
  ListUpdatingView,
  ListView,
  SidebarControlsView,
  SortDroplist,
  TypeToggleView,
  i18n,
  NoOwnerToggleView,
};
