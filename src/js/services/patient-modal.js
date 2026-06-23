import Radio from 'backbone.radio';

import App from 'js/base/app';

import { getPatientModal, ErrorView } from 'js/services/patient-modal/patient-modal_views';

export default App.extend({
  channelName: 'patient-modal',
  radioRequests: {
    'show': 'showPatientModal',
  },
  getNewPatient() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const workspaces = currentUser.getWorkspaces();

    if (workspaces.length === 1) {
      return Radio.request('entities', 'patients:model', {
        _workspaces: [workspaces.first().getResource()],
      });
    }

    return Radio.request('entities', 'patients:model');
  },
  showPatientModal(patient) {
    const { form_id: patientFormId } = Radio.request('settings', 'get', 'patient_creation_form') || {};

    patient = patient || this.getNewPatient();
    const patientClone = patient.clone();
    const patientModal = Radio.request('modal', 'show', getPatientModal({
      patient: patientClone,
      onSubmit: () => {
        if (!patient.canEdit()) {
          patientModal.destroy();
          return;
        }

        patientModal.disableSubmit();
        patient.saveAll(patientClone.attributes)
          .then(() => {
            patientModal.destroy();

            if (patientFormId && patientClone.isNew()) {
              Radio.trigger('event-router', 'patient:form', patient.id, patientFormId);
              return;
            }

            Radio.trigger('event-router', 'patient:workflow', patient.id);
          })
          .catch(({ responseData }) => {
            // This assumes that only the similar patient error is handled on the server
            const error = responseData.errors[0].detail;

            patientModal.getChildView('body').setState({
              errors: {
                name: error,
              },
            });

            const errorView = new ErrorView({ hasSearch: true, error });

            patientModal.listenTo(errorView, 'click:search', () => {
              const query = `${ patientClone.get('first_name') } ${ patientClone.get('last_name') }`;
              Radio.request('nav', 'search', query);
            });

            patientModal.showChildView('info', errorView);
          });
      },
    }));

    patientModal.disableSubmit(patient.canEdit());
    patientModal.listenTo(patientClone, {
      'change'() {
        patientModal.getRegion('info').empty();
        patientModal.disableSubmit(!patientClone.isValid());
      },
      'invalid'(model, errors) {
        const errorCode = errors.birth_date;
        if (errorCode === 'invalidDate') {
          patientModal.showChildView('info', new ErrorView({ errorCode }));
        }
      },
    });
  },
});
