import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import { renderTemplate } from 'js/i18n';

import App from 'js/base/app';

import { attachmentForCall, buildCallLogValues, contextMatchesCall, rememberCallEvent, takeTerminated, toE164 } from './eightbyeight_call_log';
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

function phoneNumbersFrom(value) {
  if (!Array.isArray(value)) return [];

  return value.reduce((numbers, item) => {
    const number = toE164(item?.number);
    if (number) numbers.push(number);
    return numbers;
  }, []);
}

function patientPhoneNumbers(patientId) {
  const field = Radio.request('entities', 'patientFields:model', {
    name: 'phones',
    _patient: { id: patientId, type: 'patients' },
  });
  if (!field?.get) return Promise.resolve([]);

  const value = field.get('value');
  if (value != null) return Promise.resolve(phoneNumbersFrom(value));

  return field.fetch()
    .then(() => phoneNumbersFrom(field.get('value')))
    .catch(() => []);
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
  return toE164(number) || number;
}

function normalizeAction(action) {
  if (!action?.id || !action.patientId) return null;

  return {
    actionId: action.id,
    patientId: action.patientId,
    patientName: action.patientName || '',
  };
}

function callKey(event) {
  if (!event) return null;

  return `${ event.direction }:${ event.searchContext }`;
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
    this.listenTo(this.getView(), 'link:call', this.onLinkCall);
    this.listenTo(Radio.channel('dialer'), 'change:currentAction', this.onCurrentAction);

    window.addEventListener('message', this.onMessage, {
      signal: this._abortController.signal,
    });

    this._call();
  },
  onStop() {
    this.stopListening();
    this._abortController?.abort();
    this._pendingAction = null;
    this._callSession = null;
    this._explicitLink = null;
    this._openAction = null;
    this._watchKey = null;
    this.dropActionTrail();
    this.getState().set({
      isDialerReady: false,
      callState: null,
      callLive: false,
      actionId: null,
      pendingCall: null,
      openAction: null,
      linkedAction: null,
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
    this.noteCallStarted(data);

    if (data.direction !== 'inbound') return;

    const state = this.getState();
    if (state.get('callState') === 'active') return;

    state.set('callState', 'ringing');
    Radio.request('dialer', 'showPatientLinks', {
      actionId: state.get('actionId'),
      number: data.searchContext,
    });
  },
  onAccepted(data) {
    this._callSession = rememberCallEvent(this._callSession, data);
    this.noteCallStarted(data);

    const state = this.getState();
    state.set('callState', 'active');

    Radio.request('dialer', 'showPatientLinks', {
      actionId: state.get('actionId'),
      number: data.searchContext,
    });
  },
  async onTerminated(data) {
    const state = this.getState();
    const endingSession = this._callSession;
    const taken = takeTerminated(endingSession, data);

    this._callSession = taken.session;
    const linked = await this.linkedAction(taken);

    Radio.request('dialer', 'eightByEightCall', buildCallLogValues(taken.saving, linked));

    if (taken.session || this._callSession !== taken.session) return;

    this.finishCall(state);
  },
  async linkedAction(taken) {
    const clicked = this.clickedAttachment(taken);
    if (clicked || taken.session) return clicked || { actionId: null, patientId: null };

    return this.liveAttachment(taken.saving);
  },
  async liveAttachment(session) {
    if (this._explicitLink) {
      return {
        actionId: this._explicitLink.actionId,
        patientId: this._explicitLink.patientId,
      };
    }

    this.rememberOpenAction(this._openAction);
    const trail = (this._actionTrail || []).slice();
    await this.settleTrail();

    const match = this.latestPhoneMatch(session, trail);

    return {
      actionId: match?.actionId || null,
      patientId: match?.patientId || null,
    };
  },
  clickedAttachment(taken) {
    const attachment = attachmentForCall(this._pendingAction, taken.saving);
    if (attachment.clear) this._pendingAction = null;
    if (!attachment.actionId) return null;

    return {
      actionId: attachment.actionId,
      patientId: patientIdForAction(attachment.actionId),
    };
  },
  finishCall(state) {
    this._explicitLink = null;
    this._watchKey = null;
    this.dropActionTrail();
    state.set({
      callState: null,
      callLive: false,
      actionId: null,
      linkedAction: null,
    });
    Radio.request('dialer', 'showPatientLinks', null);
  },
  noteCallStarted(data) {
    const session = this._callSession;
    const ownsEvent = session?.offered === data || session?.accepted === data;
    if (!ownsEvent) return;

    const key = callKey(data);
    if (this._watchKey === key) return;

    this._watchKey = key;
    this.beginCallWatch();
  },
  beginCallWatch() {
    this.dropActionTrail();
    this._openAction = this._openAction || normalizeAction(Radio.request('dialer', 'currentAction'));
    this.getState().set({
      callLive: true,
      openAction: this._openAction,
    });
    this.rememberOpenAction(this._openAction);
  },
  onCurrentAction(action) {
    const open = normalizeAction(action);
    const linked = this._explicitLink;

    if (!open || (linked && linked.actionId !== open.actionId)) {
      this._explicitLink = null;
    }

    this._openAction = open;
    this.getState().set({
      openAction: open,
      linkedAction: this._explicitLink,
    });

    if (this.getState().get('callLive')) this.rememberOpenAction(open);
  },
  onLinkCall() {
    const open = this._openAction;
    if (!open || !this.getState().get('callLive')) return;

    this._explicitLink = open;
    this.getState().set('linkedAction', open);
  },
  rememberOpenAction(action) {
    const entry = this.trailEntry(action);
    if (!entry) return;

    this.trackPhones(entry);
  },
  trailEntry(action) {
    if (!action?.actionId || !action.patientId) return null;

    const trail = this._actionTrail || (this._actionTrail = []);
    const last = trail[trail.length - 1];
    if (last?.actionId === action.actionId && last.numbers) return null;

    const entry = { actionId: action.actionId, patientId: action.patientId, numbers: null };
    trail.push(entry);

    return entry;
  },
  trackPhones(entry) {
    const pending = patientPhoneNumbers(entry.patientId)
      .then(numbers => this.keepNumbers(entry, numbers))
      .catch(() => this.keepNumbers(entry, []));

    this._trailPromises = this._trailPromises || [];
    this._trailPromises.push(pending);
  },
  keepNumbers(entry, numbers) {
    entry.numbers = numbers;
  },
  async settleTrail() {
    const pending = (this._trailPromises || []).splice(0);
    await Promise.all(pending);
  },
  latestPhoneMatch(session, trail = this._actionTrail || []) {
    for (let index = trail.length - 1; index >= 0; index--) {
      if (contextMatchesCall(trail[index].numbers, session)) return trail[index];
    }

    return null;
  },
  dropActionTrail() {
    this._actionTrail = [];
    this._trailPromises = [];
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
