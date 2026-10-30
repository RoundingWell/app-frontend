import { omit } from 'underscore';
import Backbone from 'backbone';
import parsePhoneNumber from 'libphonenumber-js/min';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import {
  EIGHTBYEIGHT_ORIGIN,
  UC_EVENT,
} from './eightbyeight_constants';
import { LayoutView } from './eightbyeight_views';

function toDialableNumber(number) {
  const phone = parsePhoneNumber(String(number), 'US');

  if (phone && phone.isValid()) return phone.number;

  return number;
}

function callDataForArtifact(data) {
  return omit(data, 'callRecording');
}

export default App.extend({
  dialerEvents: {
    [UC_EVENT.offered]: 'onOffered',
    [UC_EVENT.accepted]: 'onAccepted',
    [UC_EVENT.terminated]: 'onTerminated',
  },
  stateEvents: {
    'change:isDialerReady': 'onDialerReady',
  },
  createState() {
    return new Backbone.Model();
  },
  initialize({ patients }) {
    this.patients = patients;
    this.onMessage = this.onMessage.bind(this);
  },
  onDialerReady() {
    this._call();
  },
  onStart() {
    this._abortController?.abort();
    this._abortController = new AbortController();

    const currentView = this.getView();
    if (currentView) this.stopListening(currentView);

    this.showView(new LayoutView({
      model: this.getState(),
      collection: this.patients,
    }));

    this.listenTo(this.getView(), 'load:iframe', this.onIframeLoad);

    window.addEventListener('message', this.onMessage, {
      signal: this._abortController.signal,
    });

    this._call();
  },
  onStop() {
    this._abortController?.abort();
    this.getState().set({
      isDialerReady: false,
      callState: null,
      actionId: null,
      pendingCall: null,
    });
  },
  onBeforeDestroy() {
    this._abortController?.abort();
  },
  // TODO(8x8-demo): assumption 2. iframe load stands in for ready and logged-in.
  onIframeLoad() {
    this.getState().set('isDialerReady', true);
  },
  onMessage({ data, origin }) {
    if (origin !== EIGHTBYEIGHT_ORIGIN) return;

    this.handleDialerEvent(data);
  },
  handleDialerEvent(data) {
    if (!data || typeof data !== 'object') return;

    if (data.status === 'failed') {
      addError(new Error('8x8 dialer event rejected'));
      return;
    }

    if (data.status !== 'success') return;

    const handler = this.dialerEvents[data.eventType];
    if (!handler) return;

    this[handler](data.data || {});
  },
  onOffered(data) {
    if (data.direction !== 'inbound') return;

    const state = this.getState();
    if (state.get('callState') === 'active') return;

    state.set('callState', 'ringing');
  },
  onAccepted(data) {
    const state = this.getState();
    state.set('callState', 'active');

    Radio.request('dialer', 'showPatientLinks', {
      actionId: state.get('actionId'),
      number: data.searchContext,
    });
  },
  onTerminated(data) {
    const state = this.getState();

    Radio.request('dialer', 'eightByEightCall', {
      callData: callDataForArtifact(data),
      actionId: state.get('actionId'),
    });

    state.set({ callState: null, actionId: null });
    Radio.request('dialer', 'showPatientLinks', null);
  },
  call(number, action) {
    const state = this.getState();
    state.set('isOpen', true);

    if (state.get('callState') === 'active') return;

    state.set({
      pendingCall: toDialableNumber(number),
      actionId: action.id,
    });

    this._call();
  },
  _call() {
    const state = this.getState();
    if (!state.get('isDialerReady')) return;

    const number = state.get('pendingCall');
    if (!number) return;

    if (!this.getView().call(number)) return;

    state.set('pendingCall', null);
  },
});
