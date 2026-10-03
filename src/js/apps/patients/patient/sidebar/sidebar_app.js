import { Radio } from 'marionette';

import App from 'js/base/app';

import { SidebarLoadingView, SidebarView } from 'js/apps/patients/patient/sidebar/sidebar_views';

function getPatientSidebarRequests(patient, sidebars, options) {
  const workspacePatient = Radio.request('entities', 'fetch:workspacePatients:byPatient', patient.id, options);
  const values = sidebars.reduce((requests, sidebar) => {
    const valueRequests = sidebar.getWidgets()
      .invoke('fetchValues', patient.id, options)
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
  onBeforeStart(app, { patient, isClosable, isListSidebar }) {
    this.patient = patient;
    this.sidebars = Radio.request('sidebars', 'patient');

    const view = this.setView(new SidebarView({
      model: patient,
      isClosable,
      isListSidebar,
    }));

    view.showChildView('sidebars', new SidebarLoadingView());
    this.showView();
  },
  prepareStart({ patient }, { signal }) {
    return Promise.all(getPatientSidebarRequests(patient, this.sidebars, { signal }));
  },
  onStart() {
    this.getView().showSidebars(this.sidebars);
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
