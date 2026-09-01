import { delay } from 'underscore';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';

import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import './ringcentral.scss';

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
  className: 'ringcentral-panel__patient-btn',
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
  className: 'ringcentral-wrapper',
  template: hbs`
    <div data-patient-buttons-region></div>
    <div class="ringcentral-panel">
      <div class="ringcentral-panel__header js-header">
        {{fas "phone"}}
        <span data-heading-region>RingCentral</span>
        <span data-status-region></span>
      </div>
      <iframe
        class="ringcentral-panel__iframe"
        src="https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/app.html?clientId=e2M8xGmJjcGcHFuFe7epUC"
        title="RingCentral Dialer"
        loading="lazy"
        referrerpolicy="no-referrer"
        allow="microphone"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups">
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
    this.showPatientButtons();
    this.showCallState();
    this.showPanelStatus();
  },
  showPatientButtons() {
    this.showChildView('patientButtons', new PatientButtonsView({
      collection: this.collection,
    }));
  },
  togglePanel() {
    this.$el.toggleClass('is-open', this.model.get('isOpen'));
  },
  showCallState() {
    const callState = this.model.get('callState');

    this.ui.header.toggleClass('is-call-active', callState === 'ringing' || callState === 'active');

    if (callState === 'ringing') {
      this.showChildView('heading', new View({ template: hbs`Incoming Call` }));
      return;
    }

    if (callState === 'active') {
      this.showChildView('heading', new TimerView());
      return;
    }

    this.showChildView('heading', new View({ template: hbs`RingCentral` }));
  },
  showPanelStatus() {
    this.showChildView('status', new StatusView({ model: this.model }));
  },
});

export { LayoutView };
