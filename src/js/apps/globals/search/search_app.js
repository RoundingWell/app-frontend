import Radio from 'backbone.radio';

import App from 'js/base/app';

import { PatientSearchModal } from 'js/apps/globals/search/patient-search_views';

export default App.extend({
  onStart({ prefillText, canPatientCreate }) {
    const patientSearchModal = new PatientSearchModal({
      collection: Radio.request('entities', 'searchPatients:collection'),
      prefillText,
      canPatientCreate,
    });

    this.listenTo(patientSearchModal, {
      'search:select'(result) {
        Radio.trigger('event-router', 'patient:workflow', result.get('_patient').id);
        patientSearchModal.destroy();
      },
      'click:addPatient'() {
        Radio.request('patient-modal', 'show');
      },
      'destroy'() {
        this.stop();
      },
    });

    Radio.request('modal', 'show:custom', patientSearchModal);
  },
});
