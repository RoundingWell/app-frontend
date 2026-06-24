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

    this.sidebars = Radio.request('sidebars', 'patient');

    this.getRegion('sidebars').startPreloader();
  },
  beforeStart({ patient }) {
    const workspacePatient = Radio.request('entities', 'fetch:workspacePatients:byPatient', patient.id);
    const values = this.getWidgetValueRequests(patient.id);

    return [workspacePatient, ...values];
  },
  onStart({ patient }) {
    this.patient = patient;

    this.showView(new SidebarView({
      model: this.patient,
      collection: this.sidebars,
    }));
  },
  getWidgetValueRequests(patientId) {
    return this.sidebars.reduce((requests, sidebar) => {
      requests.push(...sidebar.getWidgets().invoke('fetchValues', patientId));
      return requests;
    }, []);
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
