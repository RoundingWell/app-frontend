import { get } from 'underscore';
import Backbone from 'backbone';
import dayjs from 'dayjs';
import { Radio } from 'marionette';
import fetcher, { handleJSON } from 'js/base/fetch';
import { applicationApi, crmApi, interactionApi } from './sdk/index';

import App from 'js/base/app';

import { LayoutView } from './five9_views';

const application = applicationApi();
const crm = crmApi();
const interaction = interactionApi();

export default App.extend({
  stateEvents: {
    'change:isLoggedIn': 'onLoginChange',
  },
  createState() {
    return new Backbone.Model();
  },
  initialize({ providerName, patients }) {
    this.patients = patients;
    this.registerApi(providerName);
    this.handleLogin();
    this.subscribe();
  },
  onStart() {
    this._abortController?.abort();
    this._abortController = new AbortController();

    this.showView(new LayoutView({
      model: this.getState(),
      collection: this.patients,
    }));

    this._call();
  },
  onStop() {
    this._abortController?.abort();
  },
  onBeforeDestroy() {
    this._abortController?.abort();
  },
  onLoginChange() {
    this._call();
  },
  registerApi(providerName) {
    crm.registerApi({
      getAdtConfig() {
        return Promise.resolve({ providerName });
      },
    });
  },
  handleLogin() {
    application.subscribe({
      loginStateChanged: ({ state }) => {
        this.getState().set('isLoggedIn', state === 'WORKING');
      },
    });
  },
  subscribe() {
    const whenRunning = method => (...args) => {
      if (!this.isRunning()) return;
      return method.apply(this, args);
    };

    interaction.subscribe({
      callStarted: whenRunning(this.onCallStarted),
      callAccepted: whenRunning(this.onCallAccepted),
      callEnded: whenRunning(this.onCallEnded),
      callFinished: whenRunning(this.onCallFinished),
    });
  },
  async onCallStarted({ callData }) {
    const state = this.getState();
    state.set('isCalling', true);
    const actionId = state.get('actionId');

    if (!actionId) return;

    Radio.request('dialer', 'five9Call', { callData, actionId });

    await interaction.setCav({
      interactionId: callData.interactionId,
      cavList: [
        {
          id: '300000000000151',
          value: actionId,
        },
      ],
    });
  },
  async onCallAccepted({ callData }) {
    const { signal } = this._abortController;
    const state = this.getState();
    state.set('callTime', dayjs());

    try {
      const number = await this._getCallNumber(callData, signal);
      if (signal.aborted) return;

      Radio.request('dialer', 'showPatientLinks', { actionId: state.get('actionId'), number });
    } catch(error) {
      if (!signal.aborted) throw error;
    }
  },
  onCallEnded() {
    this.getState().set({
      isTransferredCall: null,
      callTime: null,
    });

    Radio.request('dialer', 'showPatientLinks', null);
  },
  onCallFinished({ callLogData, callData }) {
    this.getState().set({
      isCalling: false,
      actionId: null,
      callTime: null,
      isTransferredCall: null,
    });

    Radio.request('dialer', 'five9Call', { callData, callLogData });
    Radio.request('dialer', 'showPatientLinks', null);
  },
  call(number, action) {
    const state = this.getState();
    state.set('isOpen', true);

    // If there's an active call, only show the panel
    if (state.get('isCalling')) return;

    state.set({ pendingCall: number, actionId: action.id });

    this._call();
  },
  _call() {
    // If user is not logged in, do not proceed
    const state = this.getState();
    const number = state.get('pendingCall');
    if (!state.get('isLoggedIn') || !number) return;
    interaction.click2dial({ click2DialData: { clickToDialNumber: number } });
    state.set('pendingCall', null);
  },
  async _getCallNumber(callData, signal) {
    const { number } = callData;

    if (number.includes('agent:')) {
      this.getState().set('isTransferredCall', true);

      const response = await fetcher('/api/artifacts', {
        signal,
        data: {
          filter: {
            type: 'five9-call-log',
            path: 'callData.agent',
            term: number.replace('agent:', ''),
            limit: 1,
          },
        },
      }).then(handleJSON);
      if (!response) return;

      return get(response, ['data', '0', 'attributes', 'values', 'callData', 'number']);
    }

    return number;
  },
});
