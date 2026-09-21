import Backbone from 'backbone';
import { Radio } from 'marionette';

import App from 'js/base/app';

import { LayoutView } from './ringcentral_views';

export default App.extend({
  dialerEvents: {
    'rc-dialer-status-notify': 'onDialerStatus',
    'rc-login-status-notify': 'onLoginStatus',
    'rc-call-init-notify': 'onCallInit',
    'rc-call-ring-notify': 'onCallRing',
    'rc-call-start-notify': 'onCallStart',
    'rc-call-end-notify': 'onCallEnd',
  },
  stateEvents: {
    'change:isDialerReady': 'onDialerReady',
    'change:isLoggedIn': 'onLoginChange',
  },
  createState() {
    return new Backbone.Model();
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
    this._eventListeners?.abort();
    this._eventListeners = new AbortController();

    this.showView(new LayoutView({
      model: this.getState(),
      collection: this.patients,
    }));

    window.addEventListener('message', this.onMessage.bind(this), {
      signal: this._eventListeners.signal,
    });

    this._call();
  },
  onStop() {
    this._eventListeners?.abort();
    this.getState().set({
      isDialerReady: false,
      isLoggedIn: false,
      callState: null,
      actionId: null,
      pendingCall: null,
    });
  },
  onBeforeDestroy() {
    this._eventListeners?.abort();
  },
  onMessage({ data, origin }) {
    if (origin !== 'https://apps.ringcentral.com') return;

    this.handleDialerEvent(data);
  },
  handleDialerEvent(data) {
    if (!Object.hasOwn(this.dialerEvents, data?.type)) return;

    const handler = this.dialerEvents[data.type];
    this[handler](data);
  },
  onDialerStatus({ ready }) {
    this.getState().set('isDialerReady', ready);
  },
  onLoginStatus({ loggedIn }) {
    this.getState().set('isLoggedIn', loggedIn);
  },
  onCallInit() {
    this.getState().set({ callState: null, actionId: null });
  },
  onCallRing() {
    const state = this.getState();
    if (state.get('callState') === 'active') return;

    state.set('callState', 'ringing');
  },
  onCallStart({ call }) {
    const state = this.getState();
    state.set('callState', 'active');

    Radio.request('dialer', 'showPatientLinks', {
      actionId: state.get('actionId'),
      number: call?.direction === 'Inbound' ? call?.from : call?.to,
    });
  },
  onCallEnd({ call }) {
    Radio.request('dialer', 'ringcentralCall', { callData: call });
    this.getState().set({ callState: null, actionId: null });
    Radio.request('dialer', 'showPatientLinks', null);
  },
  call(number, action) {
    const state = this.getState();
    state.set('isOpen', true);

    // If there's an active call, only show the panel
    if (state.get('callState') === 'active') return;

    state.set({ pendingCall: number, actionId: action.id });

    this._call();
  },
  _call() {
    const state = this.getState();
    if (!state.get('isDialerReady')) return;

    const number = state.get('pendingCall');
    if (!number) return;

    if (!state.get('isLoggedIn')) return;

    if (!this.getView().call(number)) return;

    state.set('pendingCall', null);
  },
});
