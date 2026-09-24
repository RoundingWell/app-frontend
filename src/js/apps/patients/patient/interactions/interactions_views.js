import Backbone from 'backbone';
import { contains, groupBy, map } from 'underscore';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';

import i18n from 'js/i18n';

import Datepicker from 'js/components/datepicker';

import './interactions.scss';

const intl = i18n.patients.patient.interactions;
const CHANNEL_LABELS = {
  sms: intl.message,
  email: intl.email,
  mail: intl.mail,
  fax: intl.fax,
  voice: intl.call,
  voicemail: intl.voicemail,
  video: intl.videoCall,
  appointment: intl.appointment,
  visit: intl.visit,
};

const ACTIVITY_LABELS = {
  sms: intl.sentMessage,
  email: intl.sentMessage,
  mail: intl.sentMessage,
  fax: intl.sentMessage,
  voice: intl.loggedCall,
  voicemail: intl.loggedCall,
  video: intl.loggedCall,
  appointment: intl.addedAppointment,
  visit: intl.addedVisit,
};

function getTimestamp(model) {
  return model.get('occurred_at') || model.get('expected_at');
}

function getDate(model) {
  return dayjs(getTimestamp(model)).format('YYYY-MM-DD');
}

function getSummary(model) {
  const metadata = model.get('metadata') || {};
  const summary = metadata.message || metadata.event || metadata.status || model.get('reference');
  return typeof summary === 'string' ? summary : '';
}

function getActor(model, patientName) {
  const metadata = model.get('metadata') || {};
  return metadata.sender || (model.get('direction') === 'inbound' ? patientName : intl.careTeam);
}

function getMarker(model, patientName) {
  if (contains(['appointment', 'visit'], model.get('channel'))) return '';
  return getActor(model, patientName).split(' ').map(name => name[0]).slice(0, 2).join('').toUpperCase();
}

function getCardTitle(model) {
  const channel = model.get('channel');
  const direction = model.get('direction') === 'inbound' ? intl.inbound : intl.outbound;
  const status = model.get('metadata')?.status;
  return `${ direction } ${ CHANNEL_LABELS[channel] || channel }${ status ? ` · ${ status }` : '' }`;
}

function getWorkName(model) {
  const action = model.getAction();
  const flow = action?.getFlow() || model.getFlow();
  return action?.get('name') || flow?.get('name');
}

const InteractionItemView = View.extend({
  tagName: 'li',
  className() {
    return `patient-interactions__item patient-interactions__item--${ this.model.get('channel') }`;
  },
  template: hbs`
    <div class="patient-interactions__activity">
      <span class="patient-interactions__marker" aria-hidden="true">{{ marker }}</span>
      <div class="patient-interactions__activity-body">
        <div class="patient-interactions__activity-line">
          <span>{{#if actor}}{{ actor }} {{/if}}{{ activityLabel }}</span>
          <time datetime="{{ timestamp }}">{{ relativeTime }}</time>
        </div>
        <div class="patient-interactions__card">
          <div class="patient-interactions__item-heading">
            <span class="patient-interactions__channel">{{ cardTitle }}</span>
            <time datetime="{{ timestamp }}">{{ displayTime }}</time>
          </div>
          {{#if summary}}<p class="patient-interactions__summary">{{ summary }}</p>{{/if}}
          {{#if workName}}<button class="patient-interactions__action js-action" type="button">↳ {{ workName }}</button>{{/if}}
        </div>
      </div>
    </div>
  `,
  triggers: {
    'click .js-action': 'click:action',
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
    const timestamp = getTimestamp(this.model);
    const channel = this.model.get('channel');

    return {
      actor: contains(['appointment', 'visit'], channel) ? '' : getActor(this.model, this.getOption('patientName')),
      activityLabel: ACTIVITY_LABELS[channel] || intl.addedInteraction,
      marker: getMarker(this.model, this.getOption('patientName')),
      cardTitle: getCardTitle(this.model),
      timestamp,
      displayTime: timestamp ? dayjs(timestamp).format('h:mm A') : '',
      relativeTime: timestamp ? dayjs(timestamp).fromNow() : '',
      summary: getSummary(this.model),
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
  triggers: { 'click .js-close': 'close' },
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
      <button class="patient-interactions__date-button js-date-button" type="button" aria-label="{{ @intl.patients.patient.interactions.jumpToDate }} {{ dateLabel }}" aria-expanded="false">
        {{ dateLabel }} <span aria-hidden="true">⌄</span>
      </button>
      <div class="patient-interactions__date-menu js-date-menu" hidden>
        <span>{{ @intl.patients.patient.interactions.jumpTo }}</span>
        <button class="js-jump" type="button" data-jump="today">{{ @intl.patients.patient.interactions.today }}</button>
        <button class="js-jump" type="button" data-jump="yesterday">{{ @intl.patients.patient.interactions.yesterday }}</button>
        <button class="js-jump" type="button" data-jump="lastWeek">{{ @intl.patients.patient.interactions.lastWeek }}</button>
        <button class="js-jump" type="button" data-jump="lastMonth">{{ @intl.patients.patient.interactions.lastMonth }}</button>
        <button class="js-jump" type="button" data-jump="beginning">{{ @intl.patients.patient.interactions.beginning }}</button>
        <button class="js-specific-date" type="button">{{ @intl.patients.patient.interactions.specificDate }}</button>
      </div>
    </div>
    <div data-content-region></div>
  `,
  regions: { content: '[data-content-region]' },
  ui: {
    dateButton: '.js-date-button',
    menu: '.js-date-menu',
    jump: '.js-jump',
    specificDate: '.js-specific-date',
  },
  events: {
    'click @ui.dateButton': 'onDateButtonClick',
    'click @ui.jump': 'onJumpClick',
    'click @ui.specificDate': 'onSpecificDateClick',
  },
  templateContext() {
    const date = this.model.id;
    return { dateLabel: dayjs(date).format('dddd, MMM D').toUpperCase() };
  },
  onRender() {
    this.showChildView('content', new InteractionsDayListView({
      collection: new Backbone.Collection(this.model.get('interactions')),
      patientId: this.getOption('patientId'),
      patientName: this.getOption('patientName'),
      interactionId: this.getOption('interactionId'),
    }));
  },
  closeMenu() {
    this.getUI('menu')[0].hidden = true;
    this.getUI('dateButton')[0].setAttribute('aria-expanded', 'false');
  },
  onDateButtonClick() {
    const menu = this.getUI('menu')[0];
    menu.hidden = !menu.hidden;
    this.getUI('dateButton')[0].setAttribute('aria-expanded', String(!menu.hidden));
  },
  onJumpClick(event) {
    const jump = event.target.dataset.jump;
    this.closeMenu();
    if (jump === 'beginning') {
      this.triggerMethod('beginning:selected');
      return;
    }
    const offsets = { yesterday: [1, 'day'], lastWeek: [1, 'week'], lastMonth: [1, 'month'] };
    const [amount, unit] = offsets[jump] || [0, 'day'];
    this.triggerMethod('date:selected', dayjs().subtract(amount, unit).format('YYYY-MM-DD'));
  },
  onSpecificDateClick() {
    this.closeMenu();
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
    this.listenTo(this.getOption('interactions'), 'reset', () => {
      this.collection.reset(groupInteractions(this.getOption('interactions')));
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

const InteractionsPreviewItemView = View.extend({
  tagName: 'li',
  className: 'patient-interactions-preview__item',
  template: hbs`
    <button class="patient-interactions-preview__link js-interaction" type="button">
      <span class="patient-interactions-preview__symbol" aria-hidden="true">{{ marker }}</span>
      <span class="patient-interactions-preview__details">
        <strong>{{ cardTitle }}</strong>
        <span class="patient-interactions-preview__sender">{{ actor }}</span>
        <time datetime="{{ timestamp }}">{{ displayTime }}</time>
      </span>
    </button>
  `,
  triggers: { 'click .js-interaction': 'click:interaction' },
  onClickInteraction() {
    Radio.trigger('event-router', 'patient:interaction', this.getOption('patientId'), this.model.id);
  },
  templateContext() {
    const timestamp = getTimestamp(this.model);
    return {
      cardTitle: getCardTitle(this.model),
      actor: getActor(this.model, this.getOption('patientName')),
      marker: this.model.get('direction') === 'inbound' ? '←' : '↗',
      timestamp,
      displayTime: timestamp ? dayjs(timestamp).format('MMM D, h:mm A') : '',
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
    <div class="patient-interactions-preview__heading">
      {{#if showHeading}}<h2>{{ @intl.patients.patient.interactions.interactionsTab }}</h2>{{/if}}
      <button class="patient-interactions-preview__all js-all" type="button">{{ @intl.patients.patient.interactions.viewAll }}</button>
    </div>
    <div data-content-region></div>
  `,
  templateContext() {
    return { showHeading: !!this.getOption('actionId') };
  },
  regions: { content: '[data-content-region]' },
  triggers: { 'click .js-all': 'click:all' },
  onClickAll() {
    Radio.trigger('event-router', 'patient:interactions', this.model.id);
  },
  onRender() {
    this.showChildView('content', new InteractionsLoadingView());
    this.requestController = new AbortController();
    const signal = this.requestController.signal;

    Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId: this.model.id,
      actionId: this.getOption('actionId'),
      limit: 3,
    }, { signal }).then(collection => {
      if (signal.aborted || this.isDestroyed()) return;
      this.showChildView('content', new InteractionsPreviewListView({
        collection,
        patientId: this.model.id,
        patientName: `${ this.model.get('first_name') } ${ this.model.get('last_name') }`,
      }));
    }).catch(() => {
      if (signal.aborted || this.isDestroyed()) return;
      this.showChildView('content', new View({
        attributes: { 'role': 'alert' },
        template: hbs`{{ @intl.patients.patient.interactions.loadError }}`,
      }));
    });
  },
  onBeforeDestroy() {
    this.requestController?.abort();
  },
});

const InteractionsPageView = View.extend({
  className: 'patient__content patient__content--scroll patient-interactions',
  template: hbs`
    <div class="patient-interactions__body">
      <nav class="patient-interactions__pages" aria-label="{{ @intl.patients.patient.interactions.pagesLabel }}">
        <button class="button patient-interactions__page js-workflow" type="button">{{ @intl.patients.patient.interactions.workflowTab }}</button>
        <span class="button patient-interactions__page is-selected" aria-current="page">{{ @intl.patients.patient.interactions.interactionsTab }}</span>
      </nav>
      <div class="patient-interactions__filters" role="group" aria-label="{{ @intl.patients.patient.interactions.typesLabel }}">
        <button class="button js-filter" type="button" data-filter="messages">{{ @intl.patients.patient.interactions.messages }}</button>
        <button class="button js-filter" type="button" data-filter="calls">{{ @intl.patients.patient.interactions.calls }}</button>
        <button class="button js-filter" type="button" data-filter="appointments">{{ @intl.patients.patient.interactions.appointments }}</button>
        <button class="button js-filter" type="button" data-filter="visits">{{ @intl.patients.patient.interactions.visits }}</button>
      </div>
      <div data-content-region></div>
      <button class="button patient-interactions__older js-older" type="button" hidden>{{ @intl.patients.patient.interactions.loadOlder }}</button>
    </div>
  `,
  regions: { content: '[data-content-region]' },
  ui: { filters: '.js-filter', older: '.js-older' },
  triggers: {
    'click .js-workflow': 'click:workflow',
    'click @ui.older': 'click:loadOlder',
  },
  events: { 'click @ui.filters': 'onFilterClick' },
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
  setCanLoadOlder(canLoadOlder) {
    this.getUI('older')[0].hidden = !canLoadOlder;
  },
  showInteractions(collection) {
    const list = new InteractionsListView({
      collection: new Backbone.Collection(groupInteractions(collection)),
      interactions: collection,
      patientId: this.model.id,
      patientName: `${ this.model.get('first_name') } ${ this.model.get('last_name') }`,
      interactionId: this.getOption('interactionId'),
    });
    this.listenTo(list, 'date:selected', date => this.triggerMethod('date:selected', date));
    this.listenTo(list, 'beginning:selected', () => this.triggerMethod('beginning:selected'));
    this.showChildView('content', list);
  },
  scrollToDate(date) {
    this.getChildView('content')?.scrollToDate(date);
  },
  showError() {
    this.showChildView('content', new View({
      className: 'patient-interactions__status',
      attributes: { 'role': 'alert' },
      template: hbs`{{ @intl.patients.patient.interactions.loadError }}`,
    }));
  },
});

export { InteractionsPageView, InteractionsLoadingView, InteractionsListView, InteractionsPreviewView };
