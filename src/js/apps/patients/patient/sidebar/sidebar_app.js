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
  setSidebarView(options) {
    const currentView = this.getView();
    if (currentView) this.stopListening(currentView);

    const view = this.setView(new SidebarView(options));

    this.listenTo(view, {
      'click:close': this.onClickClose,
      'click:patient': this.onClickPatient,
      'click:patientEdit': this.showPatientModal,
      'click:patientView': this.showPatientModal,
      'click:activeStatus': this.toggleActiveStatus,
      'click:archivedStatus': this.archivePatient,
    });

    return view;
  },
  onBeforeStart(app, { patient, isClosable, isListSidebar }) {
    this.patient = patient;
    this.sidebars = Radio.request('sidebars', 'patient');

    const view = this.setSidebarView({
      model: patient,
      isClosable,
      isListSidebar,
    }).render();

    view.showChildView('sidebars', new SidebarLoadingView());
    this.showView();
  },
  prepareStart({ patient }, { signal }) {
    return Promise.all(getPatientSidebarRequests(patient, this.sidebars, { signal }));
  },
  onStart(app, { isClosable, isListSidebar }) {
    this.setSidebarView({
      model: this.patient,
      collection: this.sidebars,
      isClosable,
      isListSidebar,
    });

    this.showView();
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
