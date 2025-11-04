import Radio from 'backbone.radio';
import dayjs from 'dayjs';
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
  initialize({ providerName }) {
    this.registerApi(providerName);
    this.handleLogin();
    this.subscribe();
  },
  startAfterInitialized: true,
  onStart() {
    this.showView(new LayoutView({ model: this.getState() }));
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

        Radio.request('dialer', 'five9CallComplete', callData.interactionId, { actionId });

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
      callAccepted: () => {
        this.setState('callTime', dayjs());
      },
      callEnded: () => {
        this.setState('callTime', null);
      },
      callFinished: ({ callLogData, callData }) => {
        this.setState('isCalling', false);
        this.setState('actionId', null);
        Radio.request('dialer', 'five9CallComplete', callData.interactionId, { callLog: callLogData });
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
});
