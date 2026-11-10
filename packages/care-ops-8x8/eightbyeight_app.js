import Backbone from 'backbone';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { attachmentForCall, buildCallLogValues, CALL_ATTACH_WINDOW_MS, callKey, sameCall, toE164 } from './eightbyeight_call_log';
import { LayoutView } from './eightbyeight_views';

export default App.extend({
  dialerEvents: {
    'mashell-voice-phone-offered-uc-event-v1': 'onOffered',
    'mashell-voice-phone-accepted-uc-event-v1': 'onAccepted',
    'mashell-voice-phone-terminated-uc-event-v1': 'onTerminated',
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
  onStart() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    this.showView(new LayoutView({
      model: this.getState(),
      collection: this.patients,
    }));
    window.addEventListener('message', this.onMessage, {
      signal: this._abortController.signal,
    });
    this._call();
  },
  onStop() {
    this._abortController?.abort();
    this._pendingClick = null;
    this._currentCall = null;
    this._lastTerminatedId = null;
    this.getState().set({
      isOpen: false,
      isDialerReady: false,
      callState: null,
      callStartedAt: null,
      pendingCall: null,
    });
    Radio.request('dialer', 'showPatientLinks', null);
  },
  onMessage({ data, origin }) {
    if (origin !== 'https://cloud8.8x8.com') return;
    if (!this.isRunning() || !Object.hasOwn(this.dialerEvents, data?.eventType)) return;

    this.onDialerEvent(data);
  },
  onDialerEvent(data) {
    if (data.status === 'failed') {
      // Schema failure is not a dial rejection. Do not automatically retry or
      // trust its unaccepted action/patient association.
      if (this._pendingClick) {
        this._pendingClick.actionId = null;
        this._pendingClick.patientId = null;
      }
      addError('8x8 dialer event failed', { eventType: data.eventType });
      return;
    }

    if (data.status !== 'success' || !data.data) return;
    // These are phone-specific event types; tolerate an omitted media field.
    if (data.data.media != null && data.data.media !== 'phone') return;
    this[this.dialerEvents[data.eventType]](data.data);
  },
  onOffered(data) {
    // Offered also means a manual search. It never binds an action or blocks dialing.
    if (data.direction !== 'inbound' || this._currentCall) return;

    this.getState().set('callState', 'ringing');
    Radio.request('dialer', 'showPatientLinks', null);
    Radio.request('dialer', 'showPatientLinks', { number: data.searchContext });
  },
  onAccepted(data) {
    const key = callKey(data);
    if (!key || sameCall(this._currentCall?.accepted, data)) return;

    const attachment = this.takeAttachment(data);
    // An unrelated call interrupted an unsent request. Do not dial it later by surprise.
    if (this.getState().get('pendingCall')) {
      this._pendingClick = null;
      this.getState().set('pendingCall', null);
    }
    this._currentCall = { accepted: data, acceptedAt: Date.now(), attachment };
    this.showCurrentCall();
  },
  showCurrentCall() {
    const current = this._currentCall;
    this.getState().set({
      callState: current ? 'active' : null,
      callStartedAt: current?.acceptedAt ?? null,
    });
    Radio.request('dialer', 'showPatientLinks', null);
    if (!current) return;

    Radio.request('dialer', 'showPatientLinks', {
      actionId: current.attachment?.actionId,
      number: current.accepted.searchContext,
    });
  },
  onTerminated(data) {
    if (!data.eventId || this._lastTerminatedId === data.eventId) return;
    this._lastTerminatedId = data.eventId;

    const active = sameCall(this._currentCall?.accepted, data) ? this._currentCall : null;
    const attachment = active ? active.attachment : this.takeAttachment(data);
    const values = buildCallLogValues({
      accepted: active?.accepted,
      terminated: data,
    }, attachment);

    // Match Five9/RingCentral: an end event clears the panel and patient links.
    // Identity matching above protects saved attribution, not UI cleanup.
    this._currentCall = null;
    this.showCurrentCall();

    Promise.resolve(Radio.request('dialer', 'eightByEightCall', values))
      .catch(() => addError('8x8 call log could not be saved'));
  },
  takeAttachment(event) {
    const attachment = attachmentForCall(this._pendingClick, event);
    if (attachment) {
      this._pendingClick = null;
      this.getState().set('pendingCall', null);
    }
    return attachment;
  },
  call(number, action) {
    const state = this.getState();
    state.set('isOpen', true);
    if (this._currentCall) return;

    const dialableNumber = toE164(number);
    if (!dialableNumber) return;

    this._pendingClick = {
      number: dialableNumber,
      actionId: action.id,
      patientId: action.getPatient()?.id || null,
      clickedAt: Date.now(),
    };
    state.set('pendingCall', dialableNumber);
    this._call();
  },
  onDialerReady() {
    this._call();
  },
  _call() {
    const state = this.getState();
    const number = state.get('pendingCall');
    if (!state.get('isDialerReady') || !number || this._currentCall) return;

    if (Date.now() - this._pendingClick.clickedAt > CALL_ATTACH_WINDOW_MS) {
      this._pendingClick = null;
      state.set('pendingCall', null);
      return;
    }

    if (!this.getView().call(number)) return;
    state.set('pendingCall', null);
  },
});
