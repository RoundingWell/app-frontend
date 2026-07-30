import { debounce, every } from 'underscore';
import Radio from 'backbone.radio';
import { View, CollectionView } from 'marionette';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';

import { alphaSort } from 'js/utils/sorting';
import intl from 'js/i18n';
import buildMatchersArray from 'js/utils/formatting/build-matchers-array';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';
import 'scss/modules/table-list.scss';

import PreloadRegion from 'js/regions/preload_region';

import Tooltip from 'js/components/tooltip';

import { TitleOwnerDroplist } from 'js/apps/patients/shared/list_views';
import { CheckComponent, DetailsTooltip } from 'js/apps/patients/shared/actions_views';

import LayoutTemplate from './layout.hbs';

import './schedule-list.scss';

const LayoutView = View.extend({
  className: 'flex-region',
  template: LayoutTemplate,
  regions: {
    filters: '[data-filters-region]',
    table: {
      el: '[data-table-region]',
      replaceElement: true,
    },
    list: {
      el: '[data-list-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
    selectAll: '[data-select-all-region]',
    title: {
      el: '[data-title-region]',
      replaceElement: true,
    },
    dateFilter: '[data-date-filter-region]',
    search: '[data-search-region]',
    count: '[data-count-region]',
  },
  childViewTriggers: {
    'attach': 'childView:attach',
    'render:children': 'childView:render:children',
  },
});

const TitleLabelView = View.extend({
  className: 'u-text--nowrap',
  getTemplate() {
    if (this.getOption('owner')) {
      return hbs`{{formatMessage (intlGet "patients.schedule.scheduleViews.titleLabelView.title") owner=owner}}`;
    }
    return hbs`{{ @intl.patients.schedule.scheduleViews.titleLabelView.label }}`;
  },
  templateContext() {
    return {
      owner: this.getOption('owner'),
    };
  },
});

const ScheduleTitleView = View.extend({
  regions: {
    label: '[data-label-region]',
    owner: '[data-owner-filter-region]',
  },
  className: 'flex list-page__title-filter',
  template: hbs`
    <span class="list-page__title-icon">{{far "calendar-star"}}</span>
    <div data-label-region></div>
    <div data-owner-filter-region></div>
    <span class="list-page__header-icon js-title-info">{{far "circle-info"}}</span>
  `,
  ui: {
    tooltip: '.js-title-info',
  },
  initialize() {
    const currentClinician = Radio.request('bootstrap', 'currentUser');
    this.shouldShowDroplist = currentClinician.can('app:schedule:clinician_filter');

    this.owner = this.model.getOwner();
  },
  onRender() {
    this.showLabel();
    this.showOwnerDroplist();

    new Tooltip({
      message: intl.patients.schedule.scheduleViews.scheduleTitleView.tooltip,
      uiView: this,
      ui: this.ui.tooltip,
      orientation: 'vertical',
      shouldDelay: true,
    });
  },
  showLabel() {
    const titleLabelView = new TitleLabelView({
      owner: this.shouldShowDroplist ? null : this.owner.get('name'),
    });

    this.showChildView('label', titleLabelView);
  },
  showOwnerDroplist() {
    if (!this.shouldShowDroplist) return;

    const ownerDroplistView = new TitleOwnerDroplist({
      owner: this.owner,
      hasTeams: false,
    });

    this.listenTo(ownerDroplistView, 'change:owner', owner => {
      this.triggerMethod('change:owner', owner);
    });

    this.showChildView('owner', ownerDroplistView);
  },
});

const AllFiltersButtonView = View.extend({
  tagName: 'button',
  className: 'button--link-large',
  template: hbs`{{far "sliders"}}<span>{{ @intl.patients.schedule.scheduleViews.allFiltersButtonView.allFiltersButton }}</span> {{#if filtersCount}}({{filtersCount}}){{/if}}`,
  triggers: {
    'click': 'click',
  },
  modelEvents: {
    'change:filtersCount': 'render',
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

const TableHeaderView = View.extend({
  className: 'table-list__header list-page__list-header schedule__list-header',
  template: hbs`
    <div class="schedule-list__header-span-2">{{ @intl.patients.schedule.scheduleViews.tableHeaderView.dueDateHeader }}</div>
    <div class="schedule-list__header-span-2">{{ @intl.patients.schedule.scheduleViews.tableHeaderView.patientHeader }}</div>
    <div class="schedule-list__header-span-2">{{ @intl.patients.schedule.scheduleViews.tableHeaderView.actionHeader }}</div>
    <div>{{ @intl.patients.schedule.scheduleViews.tableHeaderView.formheader }}</div>
  `,
});

const DayItemView = View.extend({
  className: 'schedule-list__day-list-row',
  template: hbs`
    <div class="schedule-list__due-time {{#if isOverdue}}is-overdue{{/if}}">
      <div class="schedule-list__check" data-check-region></div>
      {{#if due_time}}
        {{formatDateTime due_time "TIME" inputFormat="HH:mm:ss"}}&#8203;
      {{else}}
        <span class="schedule-list__no-time">{{ @intl.patients.schedule.scheduleViews.dayItemView.noTime }}</span>&#8203;
      {{/if}}
    </div>
    <div>
      <button class="schedule-list__patient-sidebar-icon js-patient-sidebar-button">
        {{far "address-card"}}
      </button>&#8203;
    </div>
    <div class="schedule-list__patient-name u-text--overflow-two-lines js-patient">{{ patient.first_name }} {{ patient.last_name }}&#8203;</div>
    <div class="schedule-list__action-meta">
      <span class="schedule-list__action-state action--{{ stateOptions.color }}">{{fa stateOptions.iconType stateOptions.icon}}</span><span class="schedule-list__search-helper">{{ state }}</span>&#8203;
      <span class="u-text--overflow-two-lines js-action">{{ name }}</span>&#8203;
      <span class="schedule-list__search-helper">{{ flow }}</span>&#8203;
    </div>
    <div class="schedule-list__action-details" data-details-region></div>
    <div class="schedule-list__action-form">
      {{#if form}}<span class="js-form schedule-list__action-form-icon">{{#if hasOutreach}}{{far "share-from-square"}}{{else}}{{far "square-poll-horizontal"}}{{/if}}</span>{{/if}}
    </div>
  `,
  regions: {
    check: '[data-check-region]',
    details: '[data-details-region]',
  },
  templateContext() {
    const state = this.model.getState();

    return {
      isOverdue: this.model.isOverdue(),
      state: state.get('name'),
      stateOptions: state.get('options'),
      patient: this.model.getPatient().attributes,
      form: this.model.getForm(),
      flow: this.model.getFlow() && this.model.getFlow().get('name'),
      hasOutreach: this.model.hasOutreach(),
    };
  },
  ui: {
    'actionName': '.js-action',
  },
  triggers: {
    'click .js-form': 'click:form',
    'click .js-patient-sidebar-button': 'click:patientSidebarButton',
    'click .js-patient': 'click:patient',
    'click': 'click',
  },
  modelEvents: {
    'change': 'render',
  },
  initialize({ state }) {
    this.state = state;
    this.flow = this.model.getFlow();

    this.listenTo(state, {
      'select:multiple': this.showCheck,
      'select:none': this.showCheck,
    });
  },
  onRender() {
    const canEdit = this.canEdit;
    this.canEdit = !this.model.isFlowDone() && this.model.canEdit();

    this.showDetailsTooltip();
    this.showCheck();

    if (canEdit !== this.canEdit) {
      if (!this.canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
  },
  toggleSelected(isSelected) {
    this.$el.toggleClass('is-selected', isSelected);
  },
  showCheck() {
    if (!this.canEdit) return;

    const isSelected = this.state.isSelected(this.model);
    this.toggleSelected(isSelected);
    const checkComponent = new CheckComponent({ state: { isSelected } });

    this.listenTo(checkComponent, {
      'select'(domEvent) {
        this.triggerMethod('select', this, !!domEvent.shiftKey);
      },
      'change:isSelected': this.toggleSelected,
    });

    this.showChildView('check', checkComponent);
  },
  onClickPatient() {
    Radio.trigger('event-router', 'patient:workflow', this.model.getPatient().id);
  },
  onClickForm() {
    Radio.trigger(
      'event-router',
      'patient:form:action',
      this.model.getPatient().id,
      this.model.getForm().id,
      this.model.id,
    );
  },
  onClick() {
    if (this.flow) {
      Radio.trigger('event-router', 'patient:flow:action', this.model.getPatient().id, this.flow.id, this.model.id);
      return;
    }

    Radio.trigger('event-router', 'patient:action', this.model.getPatient().id, this.model.id);
  },
  showDetailsTooltip() {
    if (!this.model.get('details')) return;

    this.showChildView('details', new DetailsTooltip({ model: this.model }));
  },
});

const DayListView = CollectionView.extend({
  childView: DayItemView,
  childViewOptions() {
    return {
      state: this.state,
    };
  },
  className: 'schedule-list__list-row',
  template: hbs`
    <div class="schedule-list__list-cell u-text--nowrap">
      <span class="schedule-list__date {{#if isToday}}is-today{{/if}}">{{formatDateTime date "D"}}</span>
      <span class="schedule-list__month-day">{{formatDateTime date "MMM, ddd"}}</span>
    </div>
    <div class="schedule-list__day-list schedule-list__list-cell" data-actions-region></div>
  `,
  templateContext() {
    const date = dayjs(this.model.get('date'));
    const today = dayjs();

    return {
      isToday: date.isSame(today, 'day'),
    };
  },
  childViewContainer: '[data-actions-region]',
  viewComparator(viewA, viewB) {
    // nullVal of 24 to ensure null due_time is last in list and due_time never exceeds 23:59:59
    return alphaSort('asc', viewA.model.get('due_time'), viewB.model.get('due_time'), '24');
  },
  initialize({ state }) {
    this.state = state;

    this.listenTo(state, 'change:searchQuery', this.searchList);
  },
  onAttach() {
    this.searchList(null, this.state.get('searchQuery'));
  },
  childViewTriggers: {
    'render': 'listItem:render',
    'change:canEdit': 'change:canEdit',
    'click:patientSidebarButton': 'click:patientSidebarButton',
    'select': 'select',
  },
  onSelect(selectedView, isShiftKeyPressed) {
    this.triggerMethod('select:list:item', selectedView, isShiftKeyPressed);
  },
  onListItemRender(view) {
    const date = dayjs(this.model.get('date'));
    view.searchString = `${ date.format('D') } ${ date.format('MMM, ddd') } ${ view.$el.text() }`;
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

const EmptyView = View.extend({
  template: hbs`
    <h2>{{ @intl.patients.schedule.scheduleViews.emptyView.noScheduledActions }}</h2>
  `,
  className: 'table-list__empty-list',
});

const EmptyFindInListView = View.extend({
  template: hbs`
    <h2>{{ @intl.patients.schedule.scheduleViews.emptyFindInListView.noResults }}</h2>
  `,
  className: 'table-list__empty-list',
});

const ScheduleListView = CollectionView.extend({
  className: 'table-list__list list-page__list schedule-list__list',
  childView: DayListView,
  childViewOptions(model) {
    if (!model) return;

    return {
      collection: model.get('actions'),
      state: this.state,
    };
  },
  childViewTriggers: {
    'select:list:item': 'select',
    'change:canEdit': 'listItem:canEdit',
    'click:patientSidebarButton': 'click:patientSidebarButton',
  },
  childViewEvents: {
    'render:children': 'onChildFilter',
  },
  emptyView() {
    if (this.collection.length && this.state.get('searchQuery')) {
      return EmptyFindInListView;
    }

    return EmptyView;
  },
  viewComparator(viewA, viewB) {
    return alphaSort('asc', viewA.model.get('date'), viewB.model.get('date'));
  },
  viewFilter(view) {
    if (this.isAttached() && this.state.get('searchQuery')) {
      return !view.isEmpty();
    }

    // 'null' string is a key from groupBy
    if (view.model.get('date') === 'null') {
      return false;
    }

    return true;
  },
  initialize({ state, editableCollection }) {
    this.state = state;
    this.editableCollection = editableCollection;

    this.onListItemCanEdit = debounce(this.onListItemCanEdit, 60);
  },
  onListItemCanEdit() {
    // NOTE: debounced in initialize
    this.triggerMethod('change:canEdit');
  },
  onRenderChildren() {
    this.setVisibleChildren();
  },
  onChildFilter: debounce(function() {
    this.filter();
  }, 10),
  setVisibleChildren() {
    const visibleActions = this.children.reduce((models, cv) => {
      return models.concat(cv.children.pluck('model'));
    }, []);
    this.triggerMethod('filtered', visibleActions);
  },
  onSelect(selectedView, isShiftKeyPressed) {
    this.state.selectRange(this.editableCollection, selectedView.model, isShiftKeyPressed);
  },
});

export {
  LayoutView,
  ScheduleTitleView,
  AllFiltersButtonView,
  TableHeaderView,
  ScheduleListView,
  SelectAllView,
};
