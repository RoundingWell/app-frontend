import Radio from 'backbone.radio';

import App from 'js/base/app';

import { SidebarView } from 'js/apps/patients/patient/sidebar/sidebar_views';

export default App.extend({
  viewEvents: {
    'click:patientEdit': 'showPatientModal',
    'click:patientView': 'showPatientModal',
    'click:activeStatus': 'toggleActiveStatus',
    'click:archivedStatus': 'archivePatient',
  },
  onBeforeStart({ patient }) {
    this.showView(new SidebarView({ model: patient }));

    this.widgets = Radio.request('widgets', 'sidebarWidgets');

    this.getRegion('widgets').startPreloader();
  },
  beforeStart({ patient }) {
    const workspacePatient = Radio.request('entities', 'fetch:workspacePatients:byPatient', patient.id);
    const values = this.widgets.invoke('fetchValues', patient.id);

    return [workspacePatient, ...values];
  },
  onStart({ patient }) {
    this.patient = patient;

    this.showView(new SidebarView({
      model: this.patient,
      collection: this.widgets,
    }));
  },
  showPatientModal() {
    Radio.request('patient-modal', 'show', this.patient);
  },
  toggleActiveStatus() {
    this.patient.toggleActiveStatus();
  },
  archivePatient() {
    this.patient.setArchivedStatus();
  },
});
