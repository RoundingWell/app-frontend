import { omit } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';
import parsePhoneNumber from 'libphonenumber-js/min';

import { EIGHTBYEIGHT_CALL_ID_FIELD } from '@roundingwell/care-ops-8x8/eightbyeight_constants.js';

import App from 'js/base/app';

const patients = new Backbone.Collection([]);

export default App.extend({
  channelName: 'dialer',
  radioRequests: {
    'call': 'call',
    'showPatientLinks': 'showPatientLinks',
    'five9Call': 'five9Call',
    'ringcentralCall': 'ringcentralCall',
    'eightByEightCall': 'eightByEightCall',
  },
  radioEvents: {
    'change:currentPatientId': 'updateCurrentPatientId',
  },
  updateCurrentPatientId(patientId) {
    patients.currentPatientId = patientId;
    patients.trigger('change:currentPatientId');
  },
  async prepareStart(options, { signal }) {
    const dialerSetting = Radio.request('settings', 'get', 'dialer');
    if (!dialerSetting) return;

    const provider = await this.loadProvider(dialerSetting);

    signal.throwIfAborted();

    if (!provider) return;

    if (!this.hasChildApp('provider')) {
      this.addChildApp('provider', new provider.DialerApp(provider.options));
    }

    await this.getChildApp('provider').start({ region: this.getRegion() });
  },
  async loadProvider(dialerSetting) {
    if (dialerSetting === 'five9') {
      const currentOrg = Radio.request('bootstrap', 'organization');
      const { default: DialerApp } = await import('@roundingwell/care-ops-five9');

      return {
        DialerApp,
        options: { patients, providerName: currentOrg.get('name') },
      };
    }

    if (dialerSetting === 'ringcentral') {
      const { default: DialerApp } = await import('@roundingwell/care-ops-ringcentral');

      return { DialerApp, options: { patients } };
    }

    if (dialerSetting === '8x8') {
      const { default: DialerApp } = await import('@roundingwell/care-ops-8x8');

      return { DialerApp, options: { patients } };
    }
  },
  onStart() {
    if (!this._pendingCall) return;

    const { number, action } = this._pendingCall;
    this._pendingCall = null;
    this.call(number, action);
  },
  onStop() {
    this._pendingCall = null;
  },
  call(number, action) {
    const provider = this.getChildApp('provider');

    if (!provider || !this.isRunning()) {
      this._pendingCall = { number, action };
      return;
    }

    provider.call(number, action);
  },
  showPatientLinks(callData) {
    if (!callData) {
      patients.reset();
      return;
    }

    const { actionId, number } = callData;

    const action = Radio.request('entities', 'actions:model', actionId);
    const patient = action.getPatient();

    if (patient) {
      this._addPatient(patient);
      return;
    }

    if (!number) return;

    const phone = parsePhoneNumber(number, 'US');

    if (phone && phone.isValid()) {
      const searchCollection = Radio.request('entities', 'searchPatients:collection');

      searchCollection.fetch({ data: { 'filter[search]': number } })
        .then(() => searchCollection.each(this._addPatient, this));
    }
  },
  five9Call(values) {
    const { callData } = values;

    Radio.request('entities', 'save:artifacts:model', {
      artifact: 'five9-call-log',
      identifier: callData.interactionId,
      values,
    });
  },
  ringcentralCall(values) {
    const { callData } = values;

    Radio.request('entities', 'save:artifacts:model', {
      artifact: 'ringcentral-call-log',
      identifier: callData.callId,
      values,
    });
  },
  eightByEightCall(values) {
    const callData = omit(values.callData, 'callRecording');

    Radio.request('entities', 'save:artifacts:model', {
      artifact: '8x8-call-log',
      identifier: callData[EIGHTBYEIGHT_CALL_ID_FIELD],
      values: {
        ...values,
        callData,
      },
    });
  },
  _addPatient(patient) {
    patients.add({
      id: patient.id,
      name: `${ patient.get('first_name') } ${ patient.get('last_name') }`,
    });
  },
});
