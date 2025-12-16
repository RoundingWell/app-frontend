import { delay } from 'underscore';
import dayjs from 'dayjs';

import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

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
    delay(() => this.render(), 60000);
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

// https://app.five9.com/clients/integrations/adt.li.main.html?f9crmapi=true&f9verticalthreshold=300px#login/showLogin
const LayoutView = View.extend({
  className: 'five9-wrapper',
  template: hbs`
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
    heading: '[data-heading-region]',
    status: '[data-status-region]',
  },
  modelEvents: {
    'change:isOpen': 'onChangeIsOpen',
    'change:isCalling': 'showCallState',
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
    this.showCallState();
    this.showPanelStatus();
  },
  togglePanel() {
    this.$el.toggleClass('is-open', this.model.get('isOpen'));
  },
  showCallState() {
    const callTime = this.model.get('callTime');
    const isCalling = !!this.model.get('isCalling');

    this.ui.header.toggleClass('is-call-active', isCalling);

    if (callTime) {
      this.showChildView('heading', new TimerView({ startTime: callTime }));
      return;
    }

    const isCallEnded = isCalling && !callTime;

    this.ui.header.toggleClass('is-call-ended', isCallEnded);

    if (isCallEnded) {
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
