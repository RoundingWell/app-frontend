import Backbone from 'backbone';
import Radio from 'backbone.radio';
import parsePhoneNumber from 'libphonenumber-js/min';

import App from 'js/base/app';

const patients = new Backbone.Collection([]);

export default App.extend({
  channelName: 'dialer',
  radioRequests: {
    'call': 'call',
    'init': 'init',
    'showPatientLinks': 'showPatientLinks',
    'five9Call': 'five9Call',
  },
  async init() {
    /* istanbul ignore next: prevent re-initialization */
    if (this._call) return;

    const dialerSetting = Radio.request('settings', 'get', 'dialer');

    if (dialerSetting === 'five9') {
      const currentOrg = Radio.request('bootstrap', 'organization');
      const providerName = currentOrg.get('name');

      const { call, init } = await import('@roundingwell/care-ops-five9');
      this._call = call;
      init({ region: this.getRegion(), providerName, patients });
    }

    if (dialerSetting === 'ringcentral') {
      const { call, init } = await import('@roundingwell/care-ops-ringcentral');
      this._call = call;
      init({ region: this.getRegion() });
    }
  },
  call(number, action) {
    this._call(number, action);
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
  _addPatient(patient) {
    patients.add({
      id: patient.id,
      name: `${ patient.get('first_name') } ${ patient.get('last_name') }`,
    });
  },
});
