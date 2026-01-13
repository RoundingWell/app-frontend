import { get } from 'underscore';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';
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
  initialize({ providerName, patients }) {
    this.patients = patients;
    this.registerApi(providerName);
    this.handleLogin();
    this.subscribe();
  },
  startAfterInitialized: true,
  onStart() {
    this.showView(new LayoutView({
      model: this.getState(),
      collection: this.patients,
    }));
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
        this.setState('isLoggedIn', state === 'WORKING');
      },
    });
  },
  subscribe() {
    interaction.subscribe({
      callStarted: async({ callData }) => {
        this.setState('isCalling', true);
        const actionId = this.getState('actionId');

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
      callAccepted: async({ callData }) => {
        this.setState('callTime', dayjs());

        const number = await this._getCallNumber(callData);

        Radio.request('dialer', 'showPatientLinks', { actionId: this.getState('actionId'), number });
      },
      callEnded: () => {
        this.setState('callTime', null);
        Radio.request('dialer', 'showPatientLinks', null);
      },
      callFinished: ({ callLogData, callData }) => {
        this.setState('isCalling', false);
        this.setState('actionId', null);
        Radio.request('dialer', 'five9Call', { callData, callLogData });
      },
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
    // If user is not logged in, do not proceed
    const number = this.getState('pendingCall');
    if (!this.getState('isLoggedIn') || !number) return;
    interaction.click2dial({ click2DialData: { clickToDialNumber: number } });
    this.setState('pendingCall', null);
  },
  async _getCallNumber(callData) {
    const { number, agent } = callData;

    if (number.includes('agent:')) {
      const { data } = await fetcher('/api/artifacts/search', {
        data: {
          filter: {
            type: 'five9-call-log',
            path: 'callData.agent',
            term: agent,
            limit: 1,
          },
        },
      }).then(handleJSON);

      return get(data, '0.attributes.callData.number');
    }

    return number;
  },
});
