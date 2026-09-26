import { debounce, every, map, some } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import dayjs from 'dayjs';

import 'scss/modules/buttons.scss';
import 'scss/modules/list-pages.scss';

import { alphaSort } from 'js/utils/sorting';
import intl from 'js/i18n';
import buildMatchersArray from 'js/utils/formatting/build-matchers-array';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import { ListPageFiltersButtonView, ListPageView } from 'js/apps/patients/shared/list-page';
import { TitleOwnerDroplist } from 'js/apps/patients/shared/list_views';
import { CheckView, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import SelectAllView from 'js/apps/patients/shared/components/select-all_view';
import DayItemTemplate from './day-item.hbs';
import DayListTemplate from './day-list.hbs';
import LayoutTemplate from './layout.hbs';

import 'scss/domain/action-icons.scss';
import 'scss/domain/patient-list.scss';
import './schedule-list.scss';

const ListErrorView = View.extend({
  className: 'schedule-list__error',
  attributes: {
    role: 'alert',
  },
  template: hbs`
    <span>{{ @intl.patients.schedule.scheduleViews.errorView.message }}</span>
    <button class="button button--text js-retry" type="button">{{ @intl.patients.schedule.scheduleViews.errorView.retry }}</button>
  `,
  triggers: {
    'click .js-retry': 'retry',
  },
});

const ScheduleDetailsTooltip = DetailsTooltip.extend({
  className: 'button button--icon action-details-tooltip schedule-list__details-tooltip',
});
const LayoutView = ListPageView.extend({
  className: 'flex-region list-page patient-list-page schedule-list-page',
  template: LayoutTemplate,
  regions: {
    filters: '[data-filters-region]',
    results: {
      el: '[data-results-region]',
      replaceElement: true,
    },
    title: {
      el: '[data-title-region]',
      replaceElement: true,
    },
    dateFilter: '[data-date-filter-region]',
    search: '[data-search-region]',
    filtersSidebar: '[data-filters-sidebar-region]',
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

const DayContentView = View.extend({
  className: 'schedule-list__day-card js-action-surface',
  template: DayItemTemplate,
  regions: { details: '[data-details-region]' },
  ui: { patient: '.js-patient' },
  onRender() {
    if (this.model.get('details')) this.showChildView('details', new ScheduleDetailsTooltip({ model: this.model }));
  },
  setPatientSelected(patientId) {
    const isSelected = this.model.getPatient().id === patientId;
    const [patient] = this.getUI('patient');
    patient.classList.toggle('patient-list__patient--selected', isSelected);
    patient.setAttribute('aria-expanded', String(isSelected));
  },
  focusPatient() {
    this.getUI('patient')[0].focus();
  },
});

const DayItemView = View.extend({
  className: 'schedule-list__day-list-row',
  attributes: {
    role: 'listitem',
  },
  template: hbs`<div class="schedule-list__check js-no-click" data-check-region></div><div data-content-region></div>`,
  regions: {
    check: '[data-check-region]',
    content: { el: '[data-content-region]', replaceElement: true },
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
      commentCount: this.model.commentCount(),
    };
  },
  events: {
    'click .js-no-click': stopEventPropagation,
    'click .js-action': 'onClickAction',
    'click .js-patient': 'onClickPatient',
    'click .js-form': 'onClickForm',
    'click .js-action-surface': 'onClickSurface',
  },
  modelEvents: {
    'change': 'onModelChange',
  },
  initialize({ state, selectedPatientId }) {
    this.state = state;
    this.flow = this.model.getFlow();
    this.selectedPatientId = selectedPatientId;
    this.bindRelatedModels();

    this.listenTo(state, {
      'select:multiple': this.showCheck,
      'select:none': this.showCheck,
    });
  },
  onRender() {
    this.showChildView('content', new DayContentView({
      model: this.model,
      templateContext: () => this.templateContext(),
    }));
    this.setPatientSelected(this.selectedPatientId);
    const canEdit = this.canEdit;
    this.canEdit = !this.model.isFlowDone() && this.model.canEdit();

    this.showCheck();

    if (canEdit !== this.canEdit) {
      if (!this.canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
  },
  bindRelatedModels() {
    if (this.patient) this.stopListening(this.patient);
    if (this.flow) this.stopListening(this.flow);
    this.patient = this.model.getPatient();
    this.flow = this.model.getFlow();
    this.listenTo(this.patient, 'change:first_name change:last_name', this.updateContent);
    if (this.flow) {
      this.listenTo(this.flow, 'change:name', this.updateContent);
      this.listenTo(this.flow, 'change:_state', this.updateEditability);
    }
  },
  updateContent() {
    this.getChildView('content').render();
    this.setPatientSelected(this.selectedPatientId);
    this.triggerMethod('content:change', this);
  },
  onModelChange() {
    if (this.model.hasChanged('_patient') || this.model.hasChanged('_flow')) this.bindRelatedModels();
    if (some(['name', 'details', 'due_date', 'due_time', '_state', '_patient', '_flow', '_form', '_comments'], attr => this.model.hasChanged(attr))) {
      this.flow = this.model.getFlow();
      this.updateContent();
    }
    this.updateEditability();
    this.triggerMethod('content:change', this);
  },
  updateEditability() {
    const canEdit = !this.model.isFlowDone() && this.model.canEdit();
    if (canEdit !== this.canEdit) {
      this.canEdit = canEdit;
      this.showCheck();
      if (!canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
  },
  toggleSelected(isSelected) {
    this.el.classList.toggle('is-selected', isSelected);
  },
  setPatientSelected(patientId) {
    this.selectedPatientId = patientId;
    this.getChildView('content').setPatientSelected(patientId);
  },
  focusPatient() {
    this.getChildView('content').focusPatient();
  },
  showCheck() {
    if (!this.canEdit) {
      this.getRegion('check').empty();
      return;
    }

    const isSelected = this.state.isSelected(this.model);
    this.toggleSelected(isSelected);
    const current = this.getChildView('check');
    if (current) {
      current.isSelected = isSelected;
      current.render();
      return;
    }
    const checkView = new CheckView({
      deselectLabel: intl.patients.schedule.scheduleViews.dayItemView.deselectAction,
      selectLabel: intl.patients.schedule.scheduleViews.dayItemView.selectAction,
      isSelected,
    });

    this.listenTo(checkView, {
      'select'(domEvent) {
        this.triggerMethod('select', this, !!domEvent.shiftKey);
      },
      'change:isSelected': this.toggleSelected,
    });

    this.showChildView('check', checkView);
  },
  onClickPatient(event) {
    event.stopImmediatePropagation();
    this.trigger('click:patient', this.model.getPatient(), this);
  },
  onClickAction(event) {
    event.stopImmediatePropagation();
    this.navigateToAction();
  },
  onClickForm(event) {
    event.stopImmediatePropagation();
    this.navigateToAction({ formExpanded: true });
  },
  onClickSurface() {
    this.navigateToAction();
  },
  navigateToAction(entryTarget) {
    if (this.flow) {
      Radio.trigger('event-router', 'patient:flow:action', this.model.getPatient().id, this.flow.id, this.model.id, entryTarget);
      return;
    }

    Radio.trigger('event-router', 'patient:action', this.model.getPatient().id, this.model.id, entryTarget);
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
    'content:change': 'listItem:render',
    'change:canEdit': 'change:canEdit',
    'select': 'select',
    'click:patient': 'click:patient',
  },
  onSelect(selectedView, isShiftKeyPressed) {
    this.triggerMethod('select:list:item', selectedView, isShiftKeyPressed);
  },
  onListItemRender(view) {
    const date = dayjs(this.model.get('date'));
    view.searchString = `${ date.format('D') } ${ date.format('MMM, ddd') } ${ view.el.textContent }`;
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
  preinitialize() {
    this.onChildFilter = debounce(this.onChildFilter, 10);
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
  initialize({ state, editableCollection, selectedPatientId, actions }) {
    this.state = state;
    this.editableCollection = editableCollection;
    this.selectedPatientId = selectedPatientId;

    this.collection = new Backbone.Collection();
    this.updateActions(actions);
    this.onListItemCanEdit = debounce(this.onListItemCanEdit, 60);
  },
  updateActions(actions) {
    const previous = this.collection.models.slice();
    const days = map(actions.groupBy('due_date'), (models, date) => {
      const day = this.collection.get(date);
      if (day) {
        day.get('actions').set(models);
        return day;
      }
      return new Backbone.Model({ id: date, date, actions: new actions.constructor(models) });
    });
    this.collection.set(days);
    previous.forEach(day => {
      if (!this.collection.has(day)) day.get('actions').reset();
    });
    this.children.each(view => {
      view.sort();
      view.filter();
    });
    this.filter();
  },
  setLoading(isLoading) {
    this.el.setAttribute('aria-busy', String(isLoading));
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
  onChildFilter() {
    this.filter();
  },
  onBeforeDestroy() {
    this.onListItemCanEdit.cancel();
    this.onChildFilter.cancel();
  },
  onDestroy() {
    this.collection.each(day => day.get('actions').reset());
    this.collection.reset();
  },
  setVisibleChildren() {
    const visibleActions = this.children.reduce((models, cv) => {
      return models.concat(cv.children.map(view => view.model));
    }, []);
    this.triggerMethod('filtered', visibleActions);
  },
  onSelect(selectedView, isShiftKeyPressed) {
    this.state.selectRange(this.editableCollection, selectedView.model, isShiftKeyPressed);
  },
});

export {
  LayoutView,
  ListErrorView,
  ScheduleTitleView,
  AllFiltersButtonView,
  ScheduleListView,
  SelectAllView,
};
