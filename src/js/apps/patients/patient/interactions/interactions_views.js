import Backbone from 'backbone';
import { contains, groupBy, map } from 'underscore';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/loader.scss';
import 'scss/modules/skeleton.scss';

import i18n from 'js/i18n';

import Tooltip from 'js/components/tooltip';

import InteractionItemView from 'js/apps/patients/shared/interactions/interaction-item_view';

import ScrollEdgesBehavior from './scroll-edges_behavior';

import InteractionDateControlView from './date-control_view';
import LayoutTemplate from './layout.hbs';
import { InteractionsLoadingView, InteractionsErrorView } from 'js/apps/patients/shared/interactions/interactions-status_views';

import 'js/apps/patients/shared/patient-pages.scss';

import './interactions.scss';

const intl = i18n.patients.patient.interactions.interactionsViews;
function getDate(model) {
  return dayjs(model.getTimestamp()).format('YYYY-MM-DD');
}

function getRelationIdentity(model) {
  const action = model.getAction();
  if (action) return `action:${ action.id }`;
  const flow = model.getFlow();
  return flow ? `flow:${ flow.id }` : undefined;
}

function canGroupInteractions(left, right) {
  if (!left || !right || getDate(left) !== getDate(right)) return false;
  if (left.getChannelGroup() !== right.getChannelGroup()) return false;
  const relation = getRelationIdentity(left);
  return !!relation && relation === getRelationIdentity(right);
}

const InteractionsDayListView = CollectionView.extend({
  tagName: 'ol',
  className: 'patient-interactions__day-list',
  childView: InteractionItemView,
  collectionEvents: { change: 'updateGrouping' },
  childViewOptions() {
    return {
      patientId: this.getOption('patientId'),
      state: this.getState(),
    };
  },
  onRenderChildren() {
    this.updateGrouping();
  },
  updateGrouping() {
    this.children.each(view => {
      const index = this.collection.indexOf(view.model);
      view.setGrouping(
        index > 0 && canGroupInteractions(this.collection.at(index - 1), view.model),
        canGroupInteractions(view.model, this.collection.at(index + 1)),
      );
    });
  },
});

const InteractionsDayView = View.extend({
  tagName: 'li',
  className: 'patient-interactions__day',
  template: hbs`
    <div class="patient-interactions__date-divider" data-date-region></div>
    <div data-content-region></div>
  `,
  regions: { date: '[data-date-region]', content: '[data-content-region]' },
  childViewTriggers: {
    'select:date': 'select:date',
  },
  modelEvents: { 'change:interactions': 'updateInteractions' },
  updateInteractions() {
    this.getChildView('content')?.collection.set(this.model.get('interactions'));
  },
  onRender() {
    this.showChildView('date', new InteractionDateControlView({ model: this.model }));
    this.showChildView('content', new InteractionsDayListView({
      collection: Radio.request('entities', 'interactions:collection', this.model.get('interactions')),
      patientId: this.getOption('patientId'),
      state: this.getState(),
    }));
  },
});

function groupInteractions(collection) {
  return map(groupBy(collection.models, getDate), (interactions, date) => ({ id: date, interactions }));
}

const InteractionsListView = CollectionView.extend({
  tagName: 'ol',
  className: 'patient-interactions__list',
  childView: InteractionsDayView,
  childViewOptions() {
    return {
      patientId: this.getOption('patientId'),
      state: this.getState(),
    };
  },
  childViewTriggers: {
    'select:date': 'select:date',
  },
  initialize() {
    this.listenTo(this.getOption('interactions'), 'update reset', () => {
      this.collection.set(groupInteractions(this.getOption('interactions')));
    });
  },
  getCurrentDate(top) {
    let date = this.collection.first()?.id;
    this.children.each(view => {
      if (Math.round(view.el.getBoundingClientRect().top) <= Math.round(top)) date = view.model.id;
    });
    return date;
  },
  focusInteraction(model) {
    if (!model) return;
    const day = this.collection.get(getDate(model));
    const item = this.children.findByModel(day)?.getChildView('content')?.children.findByModel(model);
    item?.focusInteraction();
  },
  scrollToDate(date, shouldFocus) {
    const day = this.collection.find(model => model.id >= date) || this.collection.last();
    if (!day) return;
    const control = this.children.findByModel(day).getChildView('date');
    control.el.scrollIntoView({ block: 'start' });
    if (shouldFocus) control.focusDate();
  },
  emptyView: View.extend({
    tagName: 'li',
    className: 'patient-interactions__empty',
    template: hbs`{{ @intl.patients.patient.interactions.interactionsViews.empty }}`,
  }),
});

const InteractionsPageView = View.extend({
  className: 'patient__content patient__content--scroll patient-interactions',
  behaviors() {
    return [{ behaviorClass: ScrollEdgesBehavior, state: this.getState() }];
  },
  stateEvents: {
    'change:selectedGroups': 'setSelectedGroups',
    'change:hasOlder change:hasNewer change:request change:retry': 'updatePaging',
    'change:contentStatus': 'updatePaging',
  },
  childViewTriggers: {
    'retry': 'retry:paging',
    'select:date': 'select:date',
  },
  template: LayoutTemplate,
  regions: { date: '[data-date-region]', content: '[data-content-region]' },
  ui: { today: '.js-today', controls: '.js-controls', filters: '.js-filter', workflow: '.js-workflow', pagingError: '.js-paging-error', pagingLoading: '.js-paging-loading', retry: '.js-retry' },
  triggers: {
    'click @ui.workflow': 'click:workflow',
    'click @ui.today': 'click:today',
    'click @ui.retry': 'retry:paging',
  },
  events: { 'click @ui.filters': 'onFilterClick', 'scroll': 'onScroll' },
  onScroll() {
    this.updateCurrentDate();
  },
  onAttach() {
    this.controlsObserver = new ResizeObserver(() => this.updateControlsHeight());
    this.controlsObserver.observe(this.getUI('controls')[0]);
    this.updateControlsHeight();
  },
  onBeforeDetach() {
    this.controlsObserver.disconnect();
  },
  updateControlsHeight() {
    const height = this.getUI('controls')[0].getBoundingClientRect().height;
    this.el.style.setProperty('--patient-interactions-controls-height', `${ height }px`);
    this.updateCurrentDate();
  },
  updateCurrentDate() {
    if (this.getState().get('contentStatus') !== 'ready') return;
    const list = this.getChildView('content');
    const gap = parseFloat(getComputedStyle(this.el).getPropertyValue('--patient-interactions-controls-gap'));
    const date = list.getCurrentDate(this.getUI('controls')[0].getBoundingClientRect().bottom + gap);
    const control = this.getChildView('date');
    control.getState().set('isVisible', !!date);
    if (date) control.model.set('id', date);
    this.updateTodayButton(list, date);
  },
  getCurrentDate() {
    return this.getChildView('date').model.id;
  },
  updateTodayButton(list, currentDate) {
    const today = dayjs().format('YYYY-MM-DD');
    const destination = list.collection.find(day => day.id >= today) || (!this.getState().get('hasNewer') && list.collection.last());
    const { request, hasNewer } = this.getState().attributes;
    const atBottom = this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight <= 1;
    this.getUI('today')[0].hidden = request?.kind === 'replace' || !list.collection.length || (!hasNewer && atBottom) || this.isTodayDestinationReached(list, destination, currentDate);
  },
  isTodayDestinationReached(list, destination, currentDate) {
    if (!destination) return false;
    if (currentDate === destination.id) return true;
    const control = list.children.findByModel(destination).getChildView('date');
    const bounds = control.el.getBoundingClientRect();
    return bounds.top >= this.getUI('controls')[0].getBoundingClientRect().bottom
      && bounds.bottom <= this.el.getBoundingClientRect().bottom - 64;
  },
  onClickToday() {
    this.triggerMethod('select:date', dayjs().format('YYYY-MM-DD'));
  },
  onClickWorkflow() {
    Radio.trigger('event-router', 'patient:workflow', this.model.id);
  },
  onFilterClick(event) {
    this.triggerMethod('change:filter', event.delegateTarget.dataset.filter);
  },
  onRender() {
    this.showChildView('date', new InteractionDateControlView({ model: new Backbone.Model({ id: dayjs().format('YYYY-MM-DD') }), stateOptions: { isVisible: false } }));
    this.setSelectedGroups();
    this.updatePaging();
    for (const button of this.getUI('filters')) {
      const id = `interaction-filter-${ this.cid }-${ button.dataset.filter }`;
      button.setAttribute('aria-describedby', id);
      new Tooltip({
        id,
        anchor: button,
        uiView: this,
        message: intl[button.dataset.filter],
        shouldDelay: true,
      });
    }
  },
  setSelectedGroups() {
    const groups = this.getState().get('selectedGroups');
    for (const button of this.getUI('filters')) {
      button.setAttribute('aria-pressed', String(contains(groups, button.dataset.filter)));
    }
  },
  updatePaging() {
    const { request, retry, contentStatus } = this.getState().attributes;
    this.el.setAttribute('aria-busy', String(!!request));
    if (contentStatus !== 'ready') this.getChildView('date').getState().set('isVisible', contentStatus === 'error');
    if (contentStatus !== 'ready') this.getUI('today')[0].hidden = true;
    const errorHeight = this.getUI('pagingError')[0].offsetHeight;
    this.getUI('pagingError')[0].hidden = !retry || retry.kind === 'replace';
    this.triggerMethod('scroll:adjust', this.getUI('pagingError')[0].offsetHeight - errorHeight);
    this.getUI('pagingLoading')[0].hidden = !request || contentStatus === 'loading';
    this.updateCurrentDate();
  },
  onScrollPosition() {
    this.updateCurrentDate();
  },
  scrollToLatest() {
    this.triggerMethod('scroll:latest');
  },
  showLoading() {
    // Keep the current feed and scroll range until its replacement is ready.
    if (this.getState().get('contentStatus') !== 'ready') {
      this.showChildView('content', new InteractionsLoadingView());
      this.getState().set('contentStatus', 'loading');
    }
    this.updatePaging();
    this.getUI('today')[0].hidden = true;
  },
  showInteractions(collection) {
    const list = new InteractionsListView({
      collection: new Backbone.Collection(groupInteractions(collection)),
      interactions: collection,
      patientId: this.model.id,
      state: this.getState(),
    });
    this.showChildView('content', list);
    this.getState().set('contentStatus', 'ready');
    this.updateCurrentDate();
  },
  updateInteractions(collection, models) {
    const prepend = models[0] !== collection.first();
    this.triggerMethod('before:commit');
    collection.set(models);
    this.triggerMethod('after:commit', { prepend });
  },
  focusInteraction(model) {
    this.getChildView('content')?.focusInteraction(model);
    this.updateCurrentDate();
  },
  scrollToDate(date) {
    this.getChildView('content')?.scrollToDate(date, document.activeElement === this.getUI('today')[0]);
    this.updateCurrentDate();
  },
  showError() {
    this.showChildView('content', new InteractionsErrorView({ canRetry: true }));
    this.getState().set('contentStatus', 'error');
  },
});

export { InteractionsPageView };
