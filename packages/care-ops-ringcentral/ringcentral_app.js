import { delay } from 'underscore';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';

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
  initialize({ patients }) {
    this.patients = patients;
  },
  onStart() {
    this.showView(new LayoutView({
      model: this.getState(),
      collection: this.patients,
    }));

    window.addEventListener('message', ({ data, origin }) => {
      if (origin !== 'https://apps.ringcentral.com') return;

      // fired when dialer is ready
      if (data.type === 'rc-dialer-status-notify') {
        this.setState('isDialerReady', data.ready);
      }

      // when a user has logged in or out in the iframe
      if (data.type === 'rc-login-status-notify') {
        this.setState('isLoggedIn', data.loggedIn);
      }

      // when user creates a call from dial pad
      if (data.type === 'rc-call-init-notify') {
        if (this._callEndTimer) {
          clearTimeout(this._callEndTimer);
          this._callEndTimer = null;
        }

        this.setState('callState', null);
        this.setState('actionId', null);
      }

      // when a user accepts a ringing inbound call or outbound call is connected
      if (data.type === 'rc-call-start-notify') {
        this.setState('callTime', dayjs());
        this.setState('callState', 'active');

        Radio.request('dialer', 'showPatientLinks', {
          actionId: this.getState('actionId'),
          number: data.call?.to,
        });
      }

      // when a call is ended
      if (data.type === 'rc-call-end-notify') {
        Radio.request('dialer', 'ringcentralCall', { callData: data.call });

        this.setState('callState', 'ended');
        this.setState('callTime', null);

        Radio.request('dialer', 'showPatientLinks', null);

        this._callEndTimer = delay(() => {
          this._callEndTimer = null;
          this.setState('callState', null);
          this.setState('actionId', null);
        }, 10000);
      }
    });
  },
  call(number, action) {
    this.setState('isOpen', true);

    // If there's an active call, only show the panel
    if (this.getState('callState') === 'active') return;

    if (this._callEndTimer) {
      clearTimeout(this._callEndTimer);
      this._callEndTimer = null;
      this.setState('callState', null);
      this.setState('actionId', null);
    }

    this.setState('pendingCall', number);
    this.setState('actionId', action.id);

    this._call();
  },
  _call() {
    if (!this.getState('isDialerReady')) return;

    const number = this.getState('pendingCall');
    if (!number) return;

    if (!this.getState('isLoggedIn')) return;

    const iframe = document.querySelector('.ringcentral-panel__iframe');
    if (!iframe) return;

    iframe.contentWindow.postMessage({
      type: 'rc-adapter-new-call',
      phoneNumber: number,
      toCall: true,
    }, 'https://apps.ringcentral.com');

    this.setState('pendingCall', null);
  },
});
