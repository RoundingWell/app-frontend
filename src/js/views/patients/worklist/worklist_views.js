import { every, debounce } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import intl, { renderTemplate } from 'js/i18n';
import underscored from 'js/utils/formatting/underscored';
import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';
import 'scss/modules/table-list.scss';

import PreloadRegion from 'js/regions/preload_region';

import Droplist from 'js/components/droplist';
import Tooltip from 'js/components/tooltip';

import { TitleOwnerDroplist } from 'js/views/patients/shared/list_views';
import { ActionTooltipTemplate, ActionEmptyView, ActionItemView } from './action_views';
import { FlowTooltipTemplate, FlowEmptyView, FlowItemView } from './flow_views';
import LayoutTemplate from './layout.hbs';
import TableHeaderTemplate from './table-header.hbs';

import './worklist-list.scss';

const i18n = intl.patients.worklist.worklistViews;

const LayoutView = View.extend({
  className: 'flex-region',
  template: LayoutTemplate,
  regions: {
    dateFilter: '[data-date-filter-region]',
    filters: '[data-filters-region]',
    toggle: '[data-toggle-region]',
    sort: '[data-sort-region]',
    table: '[data-table-region]',
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
    },
    selectAll: '[data-select-all-region]',
    title: {
      el: '[data-title-region]',
      replaceElement: true,
    },
    search: '[data-search-region]',
    count: '[data-count-region]',
  },
  childViewEvents: {
    'update:listDom': 'fixWidth',
  },
  triggers: {
    'click @ui.select': 'click:select',
  },
  ui: {
    listHeader: '.js-list-header',
    list: '.js-list',
    select: '.js-select',
  },
  initialize() {
    const userActivityCh = Radio.channel('user-activity');
    this.listenTo(userActivityCh, 'window:resize', this.fixWidth);
  },
  fixWidth() {
    /* istanbul ignore if */
    if (!this.isRendered()) return;

    const headerWidth = this.ui.listHeader.width();
    const listWidth = this.ui.list.contents().width();
    const listPadding = parseInt(this.ui.list.css('paddingRight'), 10);
    const scrollbarWidth = headerWidth - listWidth;

    this.ui.list.css({ paddingRight: `${ listPadding - scrollbarWidth }px` });
  },
});

const SelectAllView = View.extend({
  tagName: 'button',
  className: 'button--checkbox',
  attributes() {
    if (this.getOption('isDisabled')) return { disabled: 'disabled' };
  },
  triggers: {
    'click': 'click',
  },
  getTemplate() {
    if (this.getOption('isSelectAll')) return hbs`{{fas "square-check"}}`;
    if (this.getOption('isSelectNone') || this.getOption('isDisabled')) return hbs`{{fal "square"}}`;

    return hbs`{{fas "square-minus"}}`;
  },
});

const TypeToggleView = View.extend({
  template: hbs`
    <button class="{{#unless isFlowList}}button--blue{{/unless}} button-filter button__group js-toggle-actions">{{far "file-lines"}}<span>{{ @intl.patients.worklist.worklistViews.typeToggleView.actionsButton }}</span></button>{{~ remove_whitespace ~}}
    <button class="{{#if isFlowList}}button--blue{{/if}} button-filter button__group js-toggle-flows">{{fas "folder"}}<span>{{ @intl.patients.worklist.worklistViews.typeToggleView.flowsButton }}</span></button>
  `,
  templateContext() {
    return {
      isFlowList: this.getOption('isFlowList'),
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
  className: 'u-margin--l-24 u-margin--r-16',
  template: hbs`
    <button class="button-filter-toggle {{#if noOwner}}button--blue{{/if}}">
      {{ @intl.patients.worklist.worklistViews.noOwnerToggleView.noOwner }}{{#if noOwner}}{{far "xmark"}}{{/if}}
    </button>
  `,
  triggers: {
    click: 'click',
  },
});

const worklistIcons = {
  'owned-by': ['list'],
  'shared-by': ['arrow-right-arrow-left'],
  'new-past-day': ['angle-left', '1'],
  'updated-past-three-days': ['angle-left', '3'],
  'done-last-thirty-days': ['3', '0'],
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
    ownerToggle: '[data-owner-toggle-region]',
  },
  className: 'flex list-page__title-filter',
  template: hbs`
    <span class="list-page__title-icon">
      {{#each icons}}
        {{far this}}
      {{/each}}
    </span>
    <div data-label-region></div>
    <div data-owner-filter-region></div>
    <span class="list-page__header-icon js-title-info">{{far "circle-info"}}</span>
    <div data-owner-toggle-region></div>
  `,
  ui: {
    tooltip: '.js-title-info',
  },
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
    this.showOwnerToggle();

    const tooltipTemplate = this.model.isFlowType() ? FlowTooltipTemplate : ActionTooltipTemplate;
    new Tooltip({
      message: renderTemplate(tooltipTemplate, this.templateContext()),
      uiView: this,
      ui: this.ui.tooltip,
      orientation: 'vertical',
    });
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
  showOwnerToggle() {
    if (this.shouldShowClinician || !this.canViewAssignedActions) return;

    const ownerToggleView = new NoOwnerToggleView({
      model: this.model,
    });

    this.listenTo(ownerToggleView, 'click', () => {
      this.triggerMethod('toggle:noOwner');
    });

    this.showChildView('ownerToggle', ownerToggleView);
  },
});

const AllFiltersButtonView = View.extend({
  tagName: 'button',
  className: 'button--link-large',
  template: hbs`{{far "sliders"}}<span>{{ @intl.patients.worklist.worklistViews.allFiltersButtonView.allFiltersButton }}</span> {{#if filtersCount}}({{filtersCount}}){{/if}}`,
  triggers: {
    'click': 'click',
  },
  modelEvents: {
    'change:filtersCount': 'render',
  },
});

const TableHeaderView = View.extend({
  template: TableHeaderTemplate,
  tagName: 'tr',
  templateContext() {
    return {
      isFlowList: this.getOption('isFlowList'),
    };
  },
});

const EmptyFindInListView = View.extend({
  tagName: 'tr',
  template: hbs`
    <td class="table-empty-list">
      <h2>{{ @intl.patients.worklist.worklistViews.emptyFindInListView.noResults }}</h2>
    </td>
  `,
});

const ListView = CollectionView.extend({
  className: 'table-list',
  tagName: 'table',
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
    };
  },
  childViewTriggers: {
    'render': 'listItem:render',
    'change:canEdit': 'listItem:canEdit',
    'click:patientSidebarButton': 'click:patientSidebarButton',
    'select': 'select',
  },
  onListItemRender(view) {
    view.searchString = view.$el.text();
  },
  onListItemCanEdit() {
    // NOTE: debounced in initialize
    this.triggerMethod('change:canEdit');
  },
  initialize({ state, editableCollection }) {
    this.state = state;
    this.editableCollection = editableCollection;
    this.isFlowList = state.isFlowType();

    this.onListItemCanEdit = debounce(this.onListItemCanEdit, 60);

    this.listenTo(state, 'change:searchQuery', this.searchList);
  },
  onAttach() {
    this.triggerMethod('update:listDom', this);

    this.searchList(null, this.state.get('searchQuery'));
  },
  /* istanbul ignore next: future proof */
  onRenderChildren() {
    if (!this.isAttached()) return;
    this.triggerMethod('update:listDom', this);
    this.triggerMethod('filtered', this.children.map('model'));
  },
  onSelect(selectedView, isShiftKeyPressed) {
    this.state.selectRange(this.editableCollection, selectedView.model, isShiftKeyPressed);
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
    className: 'button-filter',
    template: hbs`{{far "arrow-down-arrow-up"}}{{text}}{{far "angle-down"}}`,
  },
});

export {
  LayoutView,
  ListTitleView,
  AllFiltersButtonView,
  SelectAllView,
  ListView,
  TableHeaderView,
  SortDroplist,
  TypeToggleView,
  i18n,
  NoOwnerToggleView,
};
