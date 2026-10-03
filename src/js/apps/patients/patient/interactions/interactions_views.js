import Backbone from 'backbone';
import { contains, groupBy, map } from 'underscore';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';

import i18n from 'js/i18n';

import Datepicker from 'js/components/datepicker';
import Optionlist from 'js/components/optionlist';

import { getInteractionPresentation } from './interaction-presentation';

import 'js/apps/patients/shared/patient-pages.scss';

import './interactions.scss';

const intl = i18n.patients.patient.interactions;
function getTimestamp(model) {
  return model.get('occurred_at') || model.get('expected_at');
}

function getDate(model) {
  return dayjs(getTimestamp(model)).format('YYYY-MM-DD');
}

function getWorkName(model) {
  const action = model.getAction();
  const flow = action?.getFlow() || model.getFlow();
  return action && flow ? `${ flow.get('name') }: ${ action.get('name') }` : action?.get('name') || flow?.get('name');
}

const InteractionItemView = View.extend({
  tagName: 'li',
  className() {
    return `patient-interactions__item patient-interactions__item--${ this.model.get('channel') }`;
  },
  template: hbs`
    <span class="patient-interactions__marker" aria-hidden="true">{{far icon}}</span>
    <div class="patient-interactions__activity-body">
      <div class="patient-interactions__activity-line">
        <span class="patient-interactions__activity-description">{{#if actor}}<strong>{{ actor }}</strong> {{/if}}<span class="patient-interactions__activity-label">{{ activityLabel }}</span> <span class="patient-interactions__time">{{#if viaLabel}}{{ viaLabel }} · {{/if}}<time datetime="{{ timestamp }}">{{ displayTime }}</time></span></span>
        {{#if workName}}<button class="patient-interactions__action js-action" type="button">{{ workName }} {{far "angle-right"}}</button>{{/if}}
      </div>
      <div class="patient-interactions__card">
        {{#unless isMessage}}<div class="patient-interactions__item-heading">
          <span class="patient-interactions__channel">{{ title }}</span>{{#if status}}<span class="patient-interactions__separator">·</span><span>{{ status }}</span>{{/if}}
        </div>{{/unless}}
        {{#if summary}}<p class="patient-interactions__summary">{{ summary }}</p>{{/if}}
        {{#each details}}<p class="patient-interactions__detail">{{ label }}: {{ value }}</p>{{/each}}
      </div>
    </div>
  `,
  ui: { action: '.js-action' },
  triggers: {
    'click @ui.action': 'click:action',
  },
  setGrouping(continuation, continues) {
    this.el.classList.toggle('patient-interactions__item--continuation', continuation);
    this.el.classList.toggle('patient-interactions__item--continues', continues);
  },
  onClickAction() {
    const action = this.model.getAction();
    const flow = action?.getFlow() || this.model.getFlow();
    const patientId = this.getOption('patientId');

    if (flow) {
      if (action) {
        Radio.trigger('event-router', 'patient:flow:action', patientId, flow.id, action.id);
      } else {
        Radio.trigger('event-router', 'patient:flow', patientId, flow.id);
      }
      return;
    }

    Radio.trigger('event-router', 'patient:action', patientId, action.id);
  },
  templateContext() {
    const presentation = getInteractionPresentation(this.model, this.getOption('patientName'));
    return {
      ...presentation,
      isMessage: presentation.kind === 'message',
      workName: getWorkName(this.model),
    };
  },
  onRender() {
    if (this.model.id !== this.getOption('interactionId')) return;
    this.el.classList.add('is-selected');
    this.el.tabIndex = -1;
  },
  onAttach() {
    if (this.model.id !== this.getOption('interactionId')) return;
    this.el.scrollIntoView({ block: 'center' });
    this.el.focus({ preventScroll: true });
  },
});

const InteractionsDayListView = CollectionView.extend({
  tagName: 'ol',
  className: 'patient-interactions__day-list',
  childView: InteractionItemView,
  childViewOptions() {
    return {
      patientId: this.getOption('patientId'),
      patientName: this.getOption('patientName'),
      interactionId: this.getOption('interactionId'),
    };
  },
  viewComparator: false,
  onRenderChildren() {
    this.children.each(view => {
      const index = this.collection.indexOf(view.model);
      const channel = view.model.get('channel');
      view.setGrouping(
        index > 0 && this.collection.at(index - 1).get('channel') === channel,
        this.collection.at(index + 1)?.get('channel') === channel,
      );
    });
  },
});

const InteractionDateModalView = View.extend({
  className: 'modal patient-interactions__calendar-modal',
  attributes: { 'role': 'dialog', 'aria-modal': 'true', 'aria-label': intl.specificDate },
  template: hbs`
    <div class="patient-interactions__calendar-heading">
      <h2>{{ @intl.patients.patient.interactions.specificDate }}</h2>
      <button class="js-close" type="button" aria-label="{{ @intl.patients.patient.interactions.closeDate }}">×</button>
    </div>
    <div data-calendar-region></div>
  `,
  regions: { calendar: '[data-calendar-region]' },
  ui: { close: '.js-close' },
  triggers: { 'click @ui.close': 'close' },
  events: { keydown: 'onKeyDown' },
  onAttach() {
    const datepicker = new Datepicker({
      uiView: this,
      stateOptions: { currentMonth: dayjs(this.getOption('date')) },
    });
    this.listenTo(datepicker, 'change:selectedDate', date => {
      if (!date) return;
      this.triggerMethod('date:selected', date.format('YYYY-MM-DD'));
      this.destroy();
    });
    this.showChildView('calendar', datepicker);
    this.el.tabIndex = -1;
    this.el.focus();
  },
  onClose() {
    this.destroy();
  },
  onKeyDown(event) {
    if (event.key === 'Escape') this.destroy();
  },
});

const InteractionsDayView = View.extend({
  tagName: 'li',
  className: 'patient-interactions__day',
  template: hbs`
    <div class="patient-interactions__date-divider">
      <button class="patient-interactions__date-button js-date-button" type="button" aria-label="{{ @intl.patients.patient.interactions.jumpToDate }} {{ dateLabel }}" aria-haspopup="listbox" aria-expanded="false">
        {{ dateLabel }} {{far "angle-down"}}
      </button>
    </div>
    <div data-content-region></div>
  `,
  regions: { content: '[data-content-region]' },
  ui: {
    dateButton: '.js-date-button',
  },
  triggers: {
    'click @ui.dateButton': 'date:button:click',
  },
  templateContext() {
    const date = this.model.id;
    return { dateLabel: dayjs(date).format('dddd, MMM D').toUpperCase() };
  },
  initialize() {
    this.listenTo(this.model, 'change:interactions', () => {
      this.getChildView('content')?.collection.set(this.model.get('interactions'));
    });
  },
  onRender() {
    this.showChildView('content', new InteractionsDayListView({
      collection: new Backbone.Collection(this.model.get('interactions')),
      patientId: this.getOption('patientId'),
      patientName: this.getOption('patientName'),
      interactionId: this.getOption('interactionId'),
    }));
  },
  onDateButtonClick() {
    if (this.dateMenu) {
      this.dateMenu.destroy();
      return;
    }
    const anchor = this.getUI('dateButton')[0];
    const menu = new Optionlist({
      anchor,
      uiView: this,
      headingText: intl.jumpTo,
      popWidth: 220,
      lists: [{ collection: new Backbone.Collection([
        { id: 'today', text: intl.today },
        { id: 'yesterday', text: intl.yesterday },
        { id: 'lastWeek', text: intl.lastWeek },
        { id: 'lastMonth', text: intl.lastMonth },
        { id: 'beginning', text: intl.beginning },
        { id: 'specificDate', text: intl.specificDate, hasDivider: true },
      ]) }],
    });
    this.dateMenu = menu;
    this.listenTo(menu, 'select', this.onJumpSelect);
    this.listenTo(menu, 'destroy', () => {
      this.dateMenu = null;
      anchor.setAttribute('aria-expanded', 'false');
      this.stopListening(menu);
    });
    menu.show();
    anchor.setAttribute('aria-expanded', 'true');
  },
  onJumpSelect(model) {
    const jump = model.id;
    if (jump === 'specificDate') {
      this.showDateCalendar();
      return;
    }
    if (jump === 'beginning') {
      this.triggerMethod('beginning:selected');
      return;
    }
    const offsets = { yesterday: [1, 'day'], lastWeek: [1, 'week'], lastMonth: [1, 'month'] };
    const [amount, unit] = offsets[jump] || [0, 'day'];
    this.triggerMethod('date:selected', dayjs().subtract(amount, unit).format('YYYY-MM-DD'));
  },
  showDateCalendar() {
    const modal = new InteractionDateModalView({ date: this.model.id });
    this.listenTo(modal, 'date:selected', date => this.triggerMethod('date:selected', date));
    Radio.request('modal', 'show:custom', modal);
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
      patientName: this.getOption('patientName'),
      interactionId: this.getOption('interactionId'),
    };
  },
  childViewEvents: {
    'date:selected': 'onChildDateSelect',
    'beginning:selected': 'onChildBeginningSelect',
  },
  initialize() {
    this.listenTo(this.getOption('interactions'), 'update reset', () => {
      this.collection.set(groupInteractions(this.getOption('interactions')));
    });
  },
  onChildDateSelect(view, date) {
    this.triggerMethod('date:selected', date);
  },
  onChildBeginningSelect() {
    this.triggerMethod('beginning:selected');
  },
  scrollToDate(date) {
    const day = this.collection.find(model => model.id >= date) || this.collection.last();
    if (day) this.children.findByModel(day)?.el.scrollIntoView({ block: 'start' });
  },
  emptyView: View.extend({
    tagName: 'li',
    className: 'patient-interactions__empty',
    template: hbs`{{ @intl.patients.patient.interactions.empty }}`,
  }),
  viewComparator: false,
});

const InteractionsLoadingView = View.extend({
  className: 'patient-interactions__status',
  attributes: { 'role': 'status', 'aria-busy': 'true' },
  template: hbs`{{ @intl.patients.patient.interactions.loading }}`,
});

const InteractionsErrorView = View.extend({
  className: 'patient-interactions__status',
  attributes: { role: 'alert' },
  template: hbs`{{ @intl.patients.patient.interactions.loadError }}`,
});

const InteractionsPreviewItemView = View.extend({
  tagName: 'li',
  className() {
    return `patient-interactions-preview__item patient-interactions-preview__item--${ this.model.get('channel') }`;
  },
  template: hbs`
    <button class="patient-interactions-preview__link js-interaction" type="button">
      <span class="patient-interactions-preview__symbol" aria-hidden="true">{{far icon}}</span>
      <span class="patient-interactions-preview__details">
        <strong>{{ cardTitle }}</strong>
        <span class="patient-interactions-preview__sender">{{ actor }}</span>
        <time datetime="{{ timestamp }}">{{ displayTime }}</time>
      </span>
    </button>
  `,
  ui: { interaction: '.js-interaction' },
  triggers: { 'click @ui.interaction': 'click:interaction' },
  onClickInteraction() {
    Radio.trigger('event-router', 'patient:interaction', this.getOption('patientId'), this.model.id);
  },
  templateContext() {
    const presentation = getInteractionPresentation(this.model, this.getOption('patientName'));
    return {
      ...presentation,
      cardTitle: presentation.previewTitle,
      displayTime: presentation.timestamp ? dayjs(presentation.timestamp).format('MMM D, YYYY h:mm A') : '',
    };
  },
});

const InteractionsPreviewListView = CollectionView.extend({
  tagName: 'ul',
  className: 'patient-interactions-preview__list',
  childView: InteractionsPreviewItemView,
  childViewOptions() {
    return {
      patientId: this.getOption('patientId'),
      patientName: this.getOption('patientName'),
    };
  },
  emptyView: View.extend({
    tagName: 'li',
    template: hbs`{{ @intl.patients.patient.interactions.empty }}`,
  }),
  viewComparator: false,
});

const InteractionsPreviewView = View.extend({
  className() {
    const actionClass = this.getOption('actionId') ? ' patient-interactions-preview--action' : '';
    return `patient-interactions-preview${ actionClass }`;
  },
  template: hbs`
    {{#if showHeading}}<h2 class="patient-interactions-preview__heading">{{ @intl.patients.patient.interactions.interactionsTab }}</h2>{{/if}}
    <div data-content-region></div>
    <button class="patient-interactions-preview__all js-all" type="button">{{far "arrow-right-arrow-left"}} {{ @intl.patients.patient.interactions.interactionsTab }}</button>
  `,
  templateContext() {
    return { showHeading: !!this.getOption('actionId') };
  },
  regions: { content: '[data-content-region]' },
  ui: { all: '.js-all' },
  triggers: { 'click @ui.all': 'click:all' },
  onClickAll() {
    Radio.trigger('event-router', 'patient:interactions', this.model.id);
  },
  showLoading() {
    this.showChildView('content', new InteractionsLoadingView());
  },
  showInteractions(collection) {
    this.showChildView('content', new InteractionsPreviewListView({
      collection,
      patientId: this.model.id,
      patientName: `${ this.model.get('first_name') } ${ this.model.get('last_name') }`,
    }));
  },
  showError() {
    this.showChildView('content', new InteractionsErrorView());
  },
});

const InteractionsPageView = View.extend({
  className: 'patient__content patient__content--scroll patient-interactions',
  template: hbs`
    <div class="patient-interactions__body">
      <nav class="patient-pages" aria-label="{{ @intl.patients.patient.interactions.pagesLabel }}">
        <button class="patient-pages__tab js-workflow" type="button">{{far "folder"}} {{ @intl.patients.patient.interactions.workflowTab }}</button>
        <span class="patient-pages__tab is-selected" aria-current="page">{{far "arrow-right-arrow-left"}} {{ @intl.patients.patient.interactions.interactionsTab }}</span>
      </nav>
      <div class="patient-interactions__filters" role="group" aria-label="{{ @intl.patients.patient.interactions.typesLabel }}">
        <button class="button js-filter" type="button" data-filter="messages">{{ @intl.patients.patient.interactions.messages }}</button>
        <button class="button js-filter" type="button" data-filter="calls">{{ @intl.patients.patient.interactions.calls }}</button>
        <button class="button js-filter" type="button" data-filter="appointments">{{ @intl.patients.patient.interactions.appointments }}</button>
        <button class="button js-filter" type="button" data-filter="visits">{{ @intl.patients.patient.interactions.visits }}</button>
      </div>
      <div class="patient-interactions__paging-status js-paging-error" role="alert" hidden>
        {{ @intl.patients.patient.interactions.pagingError }}
        <button class="button button--link js-retry" type="button">{{ @intl.patients.patient.interactions.retry }}</button>
      </div>
      <div data-content-region></div>
      <div class="patient-interactions__paging-status js-paging-loading" role="status" hidden>{{ @intl.patients.patient.interactions.loading }}</div>
    </div>
  `,
  regions: { content: '[data-content-region]' },
  ui: { filters: '.js-filter', workflow: '.js-workflow', pagingError: '.js-paging-error', pagingLoading: '.js-paging-loading', retry: '.js-retry' },
  triggers: {
    'click @ui.workflow': 'click:workflow',
    'click @ui.retry': 'retry:paging',
  },
  events: { 'click @ui.filters': 'onFilterClick', 'scroll': 'onScroll' },
  onScroll() {
    const top = this.el.scrollTop;
    this.scrollDirection = top < this.previousScrollTop ? 'older' : 'newer';
    this.previousScrollTop = top;
    this.checkEdges();
  },
  onAttach() {
    this.scheduleEdgeCheck();
  },
  onBeforeDestroy() {
    cancelAnimationFrame(this.edgeFrame);
  },
  scheduleEdgeCheck() {
    cancelAnimationFrame(this.edgeFrame);
    this.edgeFrame = requestAnimationFrame(() => this.checkEdges());
  },
  checkEdges() {
    if (!this.isAttached() || this.pagingLoading || this.pagingError) return;
    const direction = this.getEdgeDirection();
    if (!direction) return;
    this.triggerMethod('load:edge', direction);
  },
  getEdgeDirection() {
    const older = this.hasOlder && this.el.scrollTop <= 200;
    const newer = this.hasNewer && this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight <= 200;
    if (this.scrollDirection === 'older' && older) return 'older';
    if (newer) return 'newer';
    if (older) return 'older';
  },
  onClickWorkflow() {
    Radio.trigger('event-router', 'patient:workflow', this.model.id);
  },
  onFilterClick(event) {
    this.triggerMethod('change:filter', event.target.dataset.filter);
  },
  onRender() {
    this.setSelectedGroups(this.getOption('selectedGroups'));
  },
  setSelectedGroups(groups) {
    for (const button of this.getUI('filters')) {
      button.setAttribute('aria-pressed', String(contains(groups, button.dataset.filter)));
    }
  },
  setPaging({ hasOlder = this.hasOlder, hasNewer = this.hasNewer, loading }) {
    const errorHeight = this.getUI('pagingError')[0].offsetHeight;
    this.hasOlder = hasOlder;
    this.hasNewer = hasNewer;
    this.pagingLoading = loading;
    this.pagingError = false;
    this.getUI('pagingError')[0].hidden = true;
    this.el.scrollTop = Math.max(0, this.el.scrollTop - errorHeight);
    this.getUI('pagingLoading')[0].hidden = !loading;
    if (!loading) this.scheduleEdgeCheck();
  },
  showPagingError() {
    this.pagingLoading = false;
    this.pagingError = true;
    this.getUI('pagingLoading')[0].hidden = true;
    this.getUI('pagingError')[0].hidden = false;
    this.el.scrollTop += this.getUI('pagingError')[0].offsetHeight;
  },
  getScrollPosition() {
    return { top: this.el.scrollTop, height: this.el.scrollHeight };
  },
  restoreScrollPosition({ top, height }, prepend) {
    this.el.scrollTop = top + (prepend ? this.el.scrollHeight - height : 0);
    this.previousScrollTop = this.el.scrollTop;
  },
  scrollToLatest() {
    this.el.scrollTop = this.el.scrollHeight;
    this.previousScrollTop = this.el.scrollTop;
  },
  showLoading() {
    this.showChildView('content', new InteractionsLoadingView());
  },
  showInteractions(collection) {
    const list = new InteractionsListView({
      collection: new Backbone.Collection(groupInteractions(collection)),
      interactions: collection,
      patientId: this.model.id,
      patientName: `${ this.model.get('first_name') } ${ this.model.get('last_name') }`,
      interactionId: this.getOption('interactionId'),
    });
    const previous = this.getChildView('content');
    if (previous) this.stopListening(previous);
    this.listenTo(list, 'date:selected', date => this.triggerMethod('date:selected', date));
    this.listenTo(list, 'beginning:selected', () => this.triggerMethod('beginning:selected'));
    this.showChildView('content', list);
  },
  scrollToDate(date) {
    this.getChildView('content')?.scrollToDate(date);
  },
  showError() {
    const previous = this.getChildView('content');
    if (previous) this.stopListening(previous);
    this.showChildView('content', new InteractionsErrorView());
  },
});

export { InteractionsPageView, InteractionsPreviewView };
