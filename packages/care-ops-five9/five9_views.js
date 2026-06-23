import { delay } from 'underscore';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';

import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import './five9.scss';

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
  initialize({ startTime }) {
    this.startTime = startTime;
  },
  onRender() {
    delay(() => this.render(), 1000);
  },
  template: hbs`Call: {{ minutes }}:{{ seconds }}`,
  templateContext() {
    return timeSince(this.startTime);
  },
});

const CallEndedView = View.extend({
  initialize({ startTime }) {
    this.startTime = startTime;
  },
  template: hbs`Call Ended: {{ minutes }}:{{ seconds }}`,
  templateContext() {
    return timeSince(this.startTime);
  },
});

const StatusView = View.extend({
  getTemplate() {
    if (!this.model.get('isOpen')) return hbs`{{far "window-maximize"}}`;
    return hbs`{{far "window-minimize"}}`;
  },
});

const PatientButtonItemView = View.extend({
  tagName: 'button',
  className: 'five9-panel__patient-btn',
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

// https://app.five9.com/clients/integrations/adt.li.main.html?f9crmapi=true&f9verticalthreshold=300px#login/showLogin
const LayoutView = View.extend({
  className: 'five9-wrapper',
  template: hbs`
    <div data-patient-buttons-region></div>
    <div class="five9-panel">
      <div class="five9-panel__header js-header">
        {{fas "phone"}}
        <span data-heading-region>Five9</span>
        <span data-status-region></span>
      </div>
      <iframe
        class="five9-panel__iframe"
        src="https://app.five9.com/clients/integrations/adt.li.main.html?f9crmapi=true&f9verticalthreshold=300px"
        title="Five9 Dialer"
        loading="lazy"
        referrerpolicy="no-referrer"
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
    'change:isCalling': 'showCallState',
    'change:isTransferredCall': 'showCallState',
    'change:callTime': 'showCallState',
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
    this.showPatientButton();
    this.showCallState();
    this.showPanelStatus();
  },
  showPatientButton() {
    this.showChildView('patientButtons', new PatientButtonsView({
      collection: this.collection,
    }));
  },
  togglePanel() {
    this.$el.toggleClass('is-open', this.model.get('isOpen'));
  },
  showCallState() {
    const callTime = this.model.get('callTime');
    const hasCallTime = !!callTime;
    const isTransferredCall = !!this.model.get('isTransferredCall');
    const isCalling = !!this.model.get('isCalling');

    this.ui.header.toggleClass('is-call-active', isTransferredCall || hasCallTime);

    if (isTransferredCall) {
      this.showChildView('heading', new View({ template: hbs`Transferred Call` }));
      return;
    }

    if (hasCallTime) {
      this.showChildView('heading', new TimerView({ startTime: callTime }));
      return;
    }

    this.ui.header.toggleClass('is-call-ended', isCalling);

    if (isCalling) {
      this.showChildView('heading', new CallEndedView({ startTime: this.model.previous('callTime') }));
      return;
    }

    this.showChildView('heading', new View({ template: hbs`Five9` }));
  },
  showPanelStatus() {
    this.showChildView('status', new StatusView({ model: this.model }));
  },
});

export {
  TimerView,
  CallEndedView,
  LayoutView,
};
