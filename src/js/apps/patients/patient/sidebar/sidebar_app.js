import Radio from 'backbone.radio';

import App from 'js/base/app';

import { SidebarLoadingView, SidebarView } from 'js/apps/patients/patient/sidebar/sidebar_views';

function getPatientSidebarRequests(patient, sidebars) {
  const workspacePatient = Radio.request('entities', 'fetch:workspacePatients:byPatient', patient.id);
  const values = sidebars.reduce((requests, sidebar) => {
    const valueRequests = sidebar.getWidgets()
      .invoke('fetchValues', patient.id)
      .map(request => Promise.resolve(request).catch(() => null));

    requests.push(...valueRequests);
    return requests;
  }, []);

  return [workspacePatient, ...values];
}

export default App.extend({
  viewEvents: {
    'click:close': 'onClickClose',
    'click:patient': 'onClickPatient',
    'click:patientEdit': 'showPatientModal',
    'click:patientView': 'showPatientModal',
    'click:activeStatus': 'toggleActiveStatus',
    'click:archivedStatus': 'archivePatient',
  },
  onBeforeStart({ patient, isClosable, isListSidebar, isPreloaded }) {
    this.patient = patient;
    this.sidebars = Radio.request('sidebars', 'patient');

    this.showView(new SidebarView({
      model: patient,
      collection: isPreloaded ? this.sidebars : null,
      isClosable,
      isListSidebar,
    }));

    if (isPreloaded) return;

    this.showChildView('sidebars', new SidebarLoadingView());
  },
  beforeStart({ patient, isPreloaded }) {
    if (isPreloaded) return [];

    return getPatientSidebarRequests(patient, this.sidebars);
  },
  onStart({ patient, isClosable, isListSidebar, isPreloaded }) {
    if (isPreloaded) return;

    this.showView(new SidebarView({
      model: this.patient,
      collection: this.sidebars,
      isClosable,
      isListSidebar,
    }));
  },
  onClickClose() {
    this.trigger('close');
  },
  onClickPatient() {
    Radio.trigger('event-router', 'patient:workflow', this.patient.id);
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

export { getPatientSidebarRequests };
