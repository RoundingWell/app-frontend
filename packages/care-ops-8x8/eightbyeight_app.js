import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import parsePhoneNumber from 'libphonenumber-js/min';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import { renderTemplate } from 'js/i18n';

import App from 'js/base/app';

import { attachmentForCall, buildCallLogValues, rememberCallEvent, takeTerminated } from './eightbyeight_call_log';
import { LayoutView } from './eightbyeight_views';

// Mashell ignores startCall until the embedding domain is on
// https://cloud8.8x8.com/maestro/public/v2.0/whitelisteddomains/
// (https://developer.8x8.com/tech-partner/docs/partner-sdk-maestro-sdk-overview/).
// Set enabled to false, or delete offerManualDial, once roundingwell.com is listed.
export const COPY_NUMBER_UNTIL_WHITELISTED = {
  enabled: true,
};

const numberCopiedNotice = hbs`{{ @intl.dialer.eightByEightApp.numberCopiedNotice }}`;
const numberCopyFailedNotice = hbs`{{formatHTMLMessage (intlGet "dialer.eightByEightApp.numberCopyFailedNotice") number=number}}`;

function copyDialNumber(number) {
  try {
    const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (!writeText) return Promise.resolve(false);

    return Promise.resolve(writeText(number)).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

function patientIdForAction(actionId) {
  if (!actionId) return null;

  const action = Radio.request('entities', 'actions:model', actionId);
  if (!action) return null;

  const patient = action.getPatient();
  if (!patient) return null;

  return patient.id;
}

function toDialableNumber(number) {
  const phone = parsePhoneNumber(String(number), 'US');

  if (phone && phone.isValid()) return phone.number;

  return number;
}

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
  onDialerReady() {
    this._call();
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
    this._pendingAction = null;
    this._callSession = null;
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
  onMessage({ data, origin }) {
    if (origin !== 'https://cloud8.8x8.com') return;

    this.handleDialerEvent(data);
  },
  handleDialerEvent(data) {
    if (!data || typeof data !== 'object') return;

    if (data.status === 'failed') {
      addError(new Error('8x8 dialer event failed'), {
        eventType: data.eventType,
        error: data.data?.error,
      });
      return;
    }

    if (data.status !== 'success') return;

    if (!Object.hasOwn(this.dialerEvents, data.eventType)) return;

    const handler = this.dialerEvents[data.eventType];
    this[handler](data.data || {});
  },
  onOffered(data) {
    this._callSession = rememberCallEvent(this._callSession, data);

    if (data.direction !== 'inbound') return;

    const state = this.getState();
    if (state.get('callState') === 'active') return;

    state.set('callState', 'ringing');
  },
  onAccepted(data) {
    this._callSession = rememberCallEvent(this._callSession, data);

    const state = this.getState();
    state.set('callState', 'active');

    Radio.request('dialer', 'showPatientLinks', {
      actionId: state.get('actionId'),
      number: data.searchContext,
    });
  },
  onTerminated(data) {
    const state = this.getState();
    const taken = takeTerminated(this._callSession, data);

    this._callSession = taken.session;
    const attachment = attachmentForCall(this._pendingAction, taken.saving);
    if (attachment.clear) this._pendingAction = null;

    Radio.request('dialer', 'eightByEightCall', buildCallLogValues(taken.saving, {
      actionId: attachment.actionId,
      patientId: patientIdForAction(attachment.actionId),
    }));

    if (taken.session) return;

    state.set({ callState: null, actionId: null });
    Radio.request('dialer', 'showPatientLinks', null);
  },
  call(number, action) {
    const state = this.getState();
    const dialableNumber = toDialableNumber(number);
    state.set('isOpen', true);

    if (state.get('callState') === 'active') return;

    this.offerManualDial(dialableNumber);
    this._pendingAction = {
      number: dialableNumber,
      actionId: action.id,
      clickedAt: Date.now(),
    };
    state.set({
      pendingCall: dialableNumber,
      actionId: action.id,
    });

    this._call();
  },
  offerManualDial(number) {
    if (!COPY_NUMBER_UNTIL_WHITELISTED.enabled || !number) return;

    copyDialNumber(number).then(copied => {
      const text = copied ?
        renderTemplate(numberCopiedNotice) :
        renderTemplate(numberCopyFailedNotice, { number });

      Radio.request('alert', 'show', { text, alertType: 'info' });
    });
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
