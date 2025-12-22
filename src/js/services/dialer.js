import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

const patients = new Backbone.Collection([]);

export default App.extend({
  channelName: 'dialer',
  radioRequests: {
    'call': 'call',
    'init': 'init',
    'callNumber': 'callNumber',
    'five9CallComplete': 'five9CallComplete',
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
  },
  call(number, action) {
    this._call(number, action);
  },
  callNumber(values) {
    if (!values) {
      patients.reset();
      return;
    }

    const { actionId, number } = values;
    const action = Radio.request('entities', 'actions:model', actionId);

    if (action) {
      const patient = action.getPatient();

      if (patient) {
        patients.add({
          id: patient.id,
          name: `${ patient.get('first_name') } ${ patient.get('last_name') }`,
        });

        return;
      }
    }

    const searchCollection = Radio.request('entities', 'searchPatients:collection');

    searchCollection.fetch({ data: { 'filter[search]': number } }).then(() => {
      searchCollection.each(patient => {
        patients.add({
          id: patient.id,
          name: `${ patient.get('first_name') } ${ patient.get('last_name') }`,
        });
      });
    });
  },
  five9CallComplete(identifier, values) {
    Radio.request('entities', 'save:artifacts:model', {
      artifact: 'five9-call-log',
      identifier,
      values,
    });
  },
});
