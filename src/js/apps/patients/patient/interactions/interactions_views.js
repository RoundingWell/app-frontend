import { contains } from 'underscore';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';

import i18n from 'js/i18n';

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

function getSummary(model) {
  const metadata = model.get('metadata') || {};
  const summary = metadata.message || metadata.event || metadata.status || model.get('reference');
  return typeof summary === 'string' ? summary : '';
}

const InteractionItemView = View.extend({
  tagName: 'li',
  className: 'patient-interactions__item',
  template: hbs`
    <div class="patient-interactions__item-heading">
      <span class="patient-interactions__channel">{{ channelLabel }}</span>
      <time datetime="{{ timestamp }}">{{ displayTime }}</time>
    </div>
    {{#if summary}}<p class="patient-interactions__summary">{{ summary }}</p>{{/if}}
    {{#if actionName}}<button class="patient-interactions__action js-action" type="button">{{ actionName }}</button>{{/if}}
  `,
  triggers: {
    'click .js-action': 'click:action',
  },
  onClickAction() {
    const action = this.model.getAction();
    const flow = action?.getFlow();
    const patientId = this.getOption('patientId');

    if (flow) {
      Radio.trigger('event-router', 'patient:flow:action', patientId, flow.id, action.id);
      return;
    }

    Radio.trigger('event-router', 'patient:action', patientId, action.id);
  },
  templateContext() {
    const timestamp = this.model.get('occurred_at') || this.model.get('expected_at');
    const action = this.model.getAction();
    const channel = this.model.get('channel');

    return {
      channelLabel: CHANNEL_LABELS[channel] || channel,
      timestamp,
      displayTime: timestamp ? dayjs(timestamp).format('MMM D, YYYY h:mm A') : '',
      summary: getSummary(this.model),
      actionName: action?.get('name'),
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

const InteractionsListView = CollectionView.extend({
  tagName: 'ol',
  className: 'patient-interactions__list',
  childView: InteractionItemView,
  childViewOptions() {
    return {
      patientId: this.getOption('patientId'),
      interactionId: this.getOption('interactionId'),
    };
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
      <span>
        <span>{{ channelLabel }}</span>
        {{#if summary}}<span class="patient-interactions-preview__summary">{{ summary }}</span>{{/if}}
      </span>
      <time datetime="{{ timestamp }}">{{ displayTime }}</time>
    </button>
  `,
  triggers: { 'click .js-interaction': 'click:interaction' },
  onClickInteraction() {
    Radio.trigger('event-router', 'patient:interaction', this.getOption('patientId'), this.model.id);
  },
  templateContext() {
    const timestamp = this.model.get('occurred_at') || this.model.get('expected_at');
    return {
      channelLabel: CHANNEL_LABELS[this.model.get('channel')] || this.model.get('channel'),
      summary: getSummary(this.model),
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
    return { patientId: this.getOption('patientId') };
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
    this.showChildView('content', new InteractionsListView({
      collection,
      patientId: this.model.id,
      interactionId: this.getOption('interactionId'),
    }));
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
