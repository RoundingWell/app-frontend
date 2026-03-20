import App from 'js/base/app';

import { LayoutView } from './ringcentral_views';

export default App.extend({
  startAfterInitialized: true,
  stateEvents: {
    'change:isDialerReady': 'onDialerReady',
    'change:isLoggedIn': 'onLoginChange',
  },
  onDialerReady() {
    this._call();
  },
  onLoginChange() {
    this._call();
  },
  onStart() {
    this.showView(new LayoutView({
      model: this.getState(),
    }));

    window.addEventListener('message', ({ data }) => {
      if (data.type === 'rc-dialer-status-notify') {
        this.setState('isDialerReady', data.ready);
      }

      if (data.type === 'rc-login-status-notify') {
        this.setState('isLoggedIn', data.loggedIn);
      }

      if (data.type === 'rc-call-ring-notify') {
        this.setState('isCalling', true);
      }
    });
  },
  call(number, action) {
    this.setState('isOpen', true);

    // If there's an active call, only show the panel
    if (this.getState('isCalling')) return;

    this.setState('pendingCall', number);
    this.setState('actionId', action.id);

    this._call();
  },
  _call() {
    if (!this.getState('isDialerReady')) return;

    const number = this.getState('pendingCall');
    if (!number) return;

    if (!this.getState('isLoggedIn')) return;

    const iframe = document.querySelector('.rc-panel__iframe');
    if (!iframe) return;

    iframe.contentWindow.postMessage({
      type: 'rc-adapter-new-call',
      phoneNumber: number,
      toCall: true,
    }, '*');

    this.setState('pendingCall', null);
  },
});
