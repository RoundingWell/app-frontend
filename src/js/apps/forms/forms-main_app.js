import RouterApp from 'js/base/routerapp';

import FormApp from 'js/apps/forms/form/form_app';
import FormPatientApp from 'js/apps/forms/form/form-patient_app';

export default RouterApp.extend({
  routerAppName: 'FormsApp',

  childApps: {
    form: FormApp,
    patientForm: FormPatientApp,
  },

  eventRoutes: {
    'form:patient': {
      action: 'showFormPatient',
      route: 'patient/:id/form/:id',
    },
    'form:patientAction': {
      action: 'showFormAction',
      route: 'patient-action/:id/form/:id',
    },
  },
  showFormAction(patientActionId, formId) {
    this.startCurrent('form', { formId, patientActionId });
  },
  showFormPatient(patientId, formId) {
    this.startCurrent('patientForm', { formId, patientId });
  },
});
