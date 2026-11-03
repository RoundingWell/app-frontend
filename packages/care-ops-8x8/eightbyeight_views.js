import { delay } from 'underscore';
import dayjs from 'dayjs';

import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

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

// No sandbox: Mashell nests the softphone in a child iframe, and sandbox
// flags are inherited, so the child cannot run the way it does in a
// top-level tab. The allow list is microphone and speaker-selection from
// the Maestro embed docs, plus camera, hid, and local-network-access
// (the child iframe requests those) and autoplay (a cross-origin frame
// does not get it by default).
const LayoutView = View.extend({
  className: 'eightbyeight-wrapper',
  template: hbs`
    <div data-patient-buttons-region></div>
    <div class="eightbyeight-panel js-panel">
      <div class="eightbyeight-panel__header js-header">
        {{fas "phone"}}
        <span data-heading-region>8x8</span>
        <span data-status-region></span>
      </div>
      <iframe
        class="eightbyeight-panel__iframe js-iframe"
        src="https://cloud8.8x8.com/mashell/public/index.html?env=embeddable&nextgen=true"
        title="8x8 Dialer"
        loading="lazy"
        referrerpolicy="no-referrer"
        allow="microphone *; camera *; speaker-selection *; hid *; local-network-access *; autoplay *">
      </iframe>
    </div>
  `,
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
    panel: '.js-panel',
  },
  triggers: {
    'click @ui.header': 'click:header',
  },
  onClickHeader() {
    this.model.set('isOpen', !this.model.get('isOpen'));
  },
  onChangeIsOpen() {
    this.togglePanel();
    this.showPanelStatus();
  },
  onRender() {
    this.getUI('iframe')[0].addEventListener('load', () => this.model.set('isDialerReady', true));

    this.showPatientButtons();
    this.showCallState();
    this.showPanelStatus();
  },
  showPatientButtons() {
    this.showChildView('patientButtons', new PatientButtonsView({
      collection: this.collection,
    }));
  },
  call(number) {
    const [iframe] = this.getUI('iframe');
    if (!iframe) return false;

    iframe.contentWindow.postMessage({
      eventName: 'maEvent',
      family: 'external',
      content: {
        eventName: 'startCall',
        method: 'mapDirective',
        phoneNumber: number,
      },
      schemaVersion: '1.0.0',
    }, 'https://cloud8.8x8.com');

    return true;
  },
  togglePanel() {
    this.el.classList.toggle('is-open', this.model.get('isOpen'));
  },
  // Work for Web answers from the in-app banner at the top of the softphone.
  // A short panel scrolls, so bring that banner back into view.
  revealIncomingCall() {
    this.getUI('panel')[0].scrollTop = 0;
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
