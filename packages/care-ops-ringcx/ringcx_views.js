import { delay } from 'underscore';
import dayjs from 'dayjs';

import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import './ringcx.scss';

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

const HeadingView = View.extend({
  getTemplate() {
    if (!this.model.get('isReady')) return hbs`Connecting`;
    if (this.model.get('isCallEnded')) return hbs`Call Ended`;
    if (this.model.get('isTransferredCall')) return hbs`Transferred Call`;
    if (this.model.get('isRinging')) return hbs`Ringing`;
    if (this.model.get('pendingCall')) return hbs`Dialing`;
    return hbs`RingCX`;
  },
});

const StatusView = View.extend({
  getTemplate() {
    if (!this.model.get('isOpen')) return hbs`{{far "window-maximize"}}`;
    return hbs`{{far "window-minimize"}}`;
  },
});

const LayoutView = View.extend({
  className: 'ringcx-wrapper',
  template: hbs`
    <div class="ringcx-panel">
      <div class="ringcx-panel__header js-header">
        {{fas "phone"}}
        <span data-heading-region></span>
        <span data-status-region></span>
      </div>
      <iframe
        id="{{ frameId }}"
        class="ringcx-panel__iframe"
        src="{{ widgetUrl }}"
        title="RingCX Dialer"
        allow="microphone"
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
    'change:callTime': 'showHeading',
    'change:isCallEnded': 'showHeading',
    'change:isCalling': 'showHeading',
    'change:isOpen': 'onChangeIsOpen',
    'change:isReady': 'showHeading',
    'change:isRinging': 'showHeading',
    'change:isTransferredCall': 'showHeading',
    'change:pendingCall': 'showHeading',
  },
  ui: {
    header: '.js-header',
  },
  triggers: {
    'click @ui.header': 'click:header',
  },
  templateContext() {
    return {
      frameId: this.getOption('frameId'),
      widgetUrl: this.getOption('widgetUrl'),
    };
  },
  onClickHeader() {
    this.model.set('isOpen', !this.model.get('isOpen'));
  },
  onChangeIsOpen() {
    this.togglePanel();
    this.showPanelStatus();
  },
  onRender() {
    this.togglePanel();
    this.showHeading();
    this.showPanelStatus();
  },
  togglePanel() {
    this.$el.toggleClass('is-open', this.model.get('isOpen'));
  },
  showHeading() {
    if (this.model.get('isCallEnded') && this.model.get('callTime')) {
      this.showChildView('heading', new CallEndedView({
        startTime: this.model.get('callTime'),
      }));
      return;
    }

    if (
      this.model.get('isCalling')
      && this.model.get('callTime')
      && !this.model.get('isTransferredCall')
    ) {
      this.showChildView('heading', new TimerView({
        startTime: this.model.get('callTime'),
      }));
      return;
    }

    this.showChildView('heading', new HeadingView({ model: this.model }));
  },
  showPanelStatus() {
    this.showChildView('status', new StatusView({ model: this.model }));
  },
});

export {
  CallEndedView,
  LayoutView,
  TimerView,
};
