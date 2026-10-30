import { delay } from 'underscore';
import dayjs from 'dayjs';

import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import { buildStartCallMessage, EIGHTBYEIGHT_CTI_URL, EIGHTBYEIGHT_ORIGIN } from './eightbyeight_constants';

import './eightbyeight.scss';

function timeSince(startTime) {
  const now = dayjs();
  const diff = now.diff(startTime);
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return {
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

const TimerView = View.extend({
  initialize() {
    this.startTime = dayjs();
  },
  onRender() {
    delay(() => this.render(), 1000);
  },
  template: hbs`Call: {{ minutes }}:{{ seconds }}`,
  templateContext() {
    return timeSince(this.startTime);
  },
});

const PatientButtonItemView = View.extend({
  tagName: 'button',
  className: 'eightbyeight-panel__patient-btn',
  template: hbs`
    <span>Jump to</span>
    {{far "address-card"}}
    <span class="u-text--overflow">{{ name }}</span>
  `,
  triggers: {
    'click': 'click',
  },
  onClick() {
    Radio.trigger('event-router', 'patient:workflow', this.model.id);
  },
});

const PatientButtonsView = CollectionView.extend({
  childView: PatientButtonItemView,
  collectionEvents: {
    'change:currentPatientId': 'render',
  },
  viewFilter({ model }) {
    return this.collection.currentPatientId !== model.id;
  },
});

const StatusView = View.extend({
  getTemplate() {
    if (!this.model.get('isOpen')) return hbs`{{far "window-maximize"}}`;
    return hbs`{{far "window-minimize"}}`;
  },
});

const LayoutView = View.extend({
  className: 'eightbyeight-wrapper',
  template: hbs`
    <div data-patient-buttons-region></div>
    <div class="eightbyeight-panel">
      <div class="eightbyeight-panel__header js-header">
        {{fas "phone"}}
        <span data-heading-region>8x8</span>
        <span data-status-region></span>
      </div>
      <iframe
        class="eightbyeight-panel__iframe js-iframe"
        src="{{ ctiUrl }}"
        title="8x8 Dialer"
        loading="lazy"
        referrerpolicy="no-referrer"
        allow="microphone *; speaker-selection *"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups">
      </iframe>
    </div>
  `,
  templateContext() {
    return { ctiUrl: EIGHTBYEIGHT_CTI_URL };
  },
  regions: {
    patientButtons: '[data-patient-buttons-region]',
    heading: '[data-heading-region]',
    status: '[data-status-region]',
  },
  modelEvents: {
    'change:isOpen': 'onChangeIsOpen',
    'change:callState': 'showCallState',
  },
  ui: {
    header: '.js-header',
    iframe: '.js-iframe',
  },
  triggers: {
    'click @ui.header': 'click:header',
    'load @ui.iframe': 'load:iframe',
  },
  onClickHeader() {
    this.model.set('isOpen', !this.model.get('isOpen'));
  },
  onChangeIsOpen() {
    this.togglePanel();
    this.showPanelStatus();
  },
  onRender() {
    this.showPatientButtons();
    this.showCallState();
    this.showPanelStatus();
  },
  showPatientButtons() {
    this.showChildView('patientButtons', new PatientButtonsView({
      collection: this.collection,
    }));
  },
  // TODO(8x8-demo): assumption 1. postMessage to EIGHTBYEIGHT_ORIGIN.
  call(number) {
    const [iframe] = this.getUI('iframe');
    if (!iframe) return false;

    iframe.contentWindow.postMessage(buildStartCallMessage(number), EIGHTBYEIGHT_ORIGIN);

    return true;
  },
  togglePanel() {
    this.el.classList.toggle('is-open', this.model.get('isOpen'));
  },
  showCallState() {
    const callState = this.model.get('callState');
    const [header] = this.getUI('header');

    header.classList.toggle('is-call-active', callState === 'ringing' || callState === 'active');

    if (callState === 'ringing') {
      this.showChildView('heading', new View({ template: hbs`Incoming Call` }));
      return;
    }

    if (callState === 'active') {
      this.showChildView('heading', new TimerView());
      return;
    }

    this.showChildView('heading', new View({ template: hbs`8x8` }));
  },
  showPanelStatus() {
    this.showChildView('status', new StatusView({ model: this.model }));
  },
});

export { LayoutView };
