import { debounce, every } from 'underscore';
import Radio from 'backbone.radio';
import { View, CollectionView } from 'marionette';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';

import { alphaSort } from 'js/utils/sorting';
import intl from 'js/i18n';
import buildMatchersArray from 'js/utils/formatting/build-matchers-array';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import PreloadRegion from 'js/regions/preload_region';

import { ListPageFiltersButtonView, ListPageView } from 'js/apps/patients/shared/list-page';
import { TitleOwnerDroplist } from 'js/apps/patients/shared/list_views';
import { CheckComponent, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import SelectAllView from 'js/apps/patients/shared/components/select-all_view';
import { setActionEntryTarget } from 'js/apps/patients/patient/action/action-entry-target';

import DayItemTemplate from './day-item.hbs';
import DayListTemplate from './day-list.hbs';
import LayoutTemplate from './layout.hbs';

import 'scss/domain/action-icons.scss';
import 'scss/domain/patient-list.scss';
import './schedule-list.scss';

const ScheduleDetailsTooltip = DetailsTooltip.extend({
  className: 'button button--icon action-details-tooltip schedule-list__details-tooltip',
});
const LayoutView = ListPageView.extend({
  className: 'flex-region list-page patient-list-page schedule-list-page',
  template: LayoutTemplate,
  regions: {
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
    dateFilter: '[data-date-filter-region]',
    search: '[data-search-region]',
    filtersSidebar: {
      el: '[data-filters-sidebar-region]',
      regionClass: PreloadRegion,
    },
  },
  modelEvents: {
    'change:filtersSidebarCollapsed': 'onChangeFiltersSidebarCollapsed',
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
  className: 'flex list-page__title-content',
  template: hbs`
    <span class="list-page__title-icon">{{far "calendar-star" classes="list-page__title-glyph"}}</span>
    <div data-label-region></div>
    <div data-owner-filter-region></div>
  `,
  initialize() {
    const currentClinician = Radio.request('bootstrap', 'currentUser');
    this.shouldShowDroplist = currentClinician.can('app:schedule:clinician_filter');

    this.owner = this.model.getOwner();
  },
  onRender() {
    this.showLabel();
    this.showOwnerDroplist();
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

const AllFiltersButtonView = ListPageFiltersButtonView.extend({
  controlsId: 'schedule-list-sidebar',
  label: intl.patients.schedule.scheduleViews.allFiltersButtonView.allFiltersButton,
});

const DayItemView = View.extend({
  className: 'schedule-list__day-list-row',
  attributes: {
    role: 'listitem',
  },
  template: DayItemTemplate,
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
      commentCount: this.model.commentCount(),
    };
  },
  triggers: {
    'click .js-form': 'click:form',
  },
  events: {
    'click .js-action-surface': 'navigateToAction',
    'click .js-no-click': stopEventPropagation,
    'click .js-action': 'onClickAction',
    'click .js-patient': 'onClickPatient',
  },
  modelEvents: {
    'change': 'render',
  },
  initialize({ state, selectedPatientId }) {
    this.state = state;
    this.flow = this.model.getFlow();
    this.selectedPatientId = selectedPatientId;

    this.listenTo(state, {
      'select:multiple': this.showCheck,
      'select:none': this.showCheck,
    });
  },
  onRender() {
    this.setPatientSelected(this.selectedPatientId);
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
  setPatientSelected(patientId) {
    this.selectedPatientId = patientId;
    const isSelected = this.model.getPatient().id === patientId;
    this.$('.js-patient')
      .toggleClass('patient-list__patient--selected', isSelected)
      .attr('aria-expanded', String(isSelected));
  },
  showCheck() {
    if (!this.canEdit) return;

    const isSelected = this.state.isSelected(this.model);
    this.toggleSelected(isSelected);
    const checkComponent = new CheckComponent({
      deselectLabel: intl.patients.schedule.scheduleViews.dayItemView.deselectAction,
      selectLabel: intl.patients.schedule.scheduleViews.dayItemView.selectAction,
      state: { isSelected },
    });

    this.listenTo(checkComponent, {
      'select'(domEvent) {
        this.triggerMethod('select', this, !!domEvent.shiftKey);
      },
      'change:isSelected': this.toggleSelected,
    });

    this.showChildView('check', checkComponent);
  },
  onClickPatient(event) {
    event.stopPropagation();
    this.trigger('click:patient', this.model.getPatient(), event.currentTarget);
  },
  onClickAction(event) {
    event.stopPropagation();
    this.navigateToAction();
  },
  onClickForm() {
    setActionEntryTarget(this.model.id, { formExpanded: true });
    this.navigateToAction();
  },
  navigateToAction() {
    if (this.flow) {
      Radio.trigger('event-router', 'patient:flow:action', this.model.getPatient().id, this.flow.id, this.model.id);
      return;
    }

    Radio.trigger('event-router', 'patient:action', this.model.getPatient().id, this.model.id);
  },
  showDetailsTooltip() {
    if (!this.model.get('details')) return;

    this.showChildView('details', new ScheduleDetailsTooltip({ model: this.model }));
  },
});

const DayListView = CollectionView.extend({
  childView: DayItemView,
  childViewOptions() {
    return {
      selectedPatientId: this.selectedPatientId,
      state: this.state,
    };
  },
  className: 'schedule-list__list-row',
  attributes: {
    role: 'listitem',
  },
  template: DayListTemplate,
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
  initialize({ state, selectedPatientId }) {
    this.state = state;
    this.selectedPatientId = selectedPatientId;

    this.listenTo(state, 'change:searchQuery', this.searchList);
  },
  onAttach() {
    this.searchList(null, this.state.get('searchQuery'));
  },
  setPatientSelected(patientId) {
    this.selectedPatientId = patientId;
    this.children.each(view => view.setPatientSelected(patientId));
  },
  childViewTriggers: {
    'render': 'listItem:render',
    'change:canEdit': 'change:canEdit',
    'select': 'select',
    'click:patient': 'click:patient',
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
  className: 'schedule-list__empty',
  attributes: {
    role: 'listitem',
  },
});

const EmptyFindInListView = View.extend({
  template: hbs`
    <h2>{{ @intl.patients.schedule.scheduleViews.emptyFindInListView.noResults }}</h2>
  `,
  className: 'schedule-list__empty',
  attributes: {
    role: 'listitem',
  },
});

const ScheduleListView = CollectionView.extend({
  className: 'list-page__list schedule-list__list',
  attributes: {
    role: 'list',
  },
  childView: DayListView,
  childViewOptions(model) {
    if (!model) return;

    return {
      collection: model.get('actions'),
      selectedPatientId: this.selectedPatientId,
      state: this.state,
    };
  },
  childViewTriggers: {
    'select:list:item': 'select',
    'change:canEdit': 'listItem:canEdit',
    'click:patient': 'click:patient',
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
  initialize({ state, editableCollection, selectedPatientId }) {
    this.state = state;
    this.editableCollection = editableCollection;
    this.selectedPatientId = selectedPatientId;

    this.onListItemCanEdit = debounce(this.onListItemCanEdit, 60);
  },
  onListItemCanEdit() {
    // NOTE: debounced in initialize
    this.triggerMethod('change:canEdit');
  },
  onRenderChildren() {
    this.setVisibleChildren();
  },
  setPatientSelected(patientId) {
    this.selectedPatientId = patientId;
    this.children.each(view => view.setPatientSelected(patientId));
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
  ScheduleListView,
  SelectAllView,
};
