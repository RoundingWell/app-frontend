import { Radio } from 'marionette';

import PatientSidebarApp, { getPatientSidebarRequests } from 'js/apps/patients/patient/sidebar/sidebar_app';
import { SidebarLoadingView, SidebarView } from 'js/apps/patients/patient/sidebar/sidebar_views';

export default PatientSidebarApp.extend({
  onBeforeStart(app, { patient }) {
    this.patient = patient;
    this.sidebars = Radio.request('sidebars', 'patient');

    const view = this.setView(new SidebarView({
      model: patient,
      isClosable: true,
      isListSidebar: true,
    }));

    view.showChildView('sidebars', new SidebarLoadingView());
    this.showView();
    this.triggerMethod('show:sidebar');
  },
  async prepareStart({ patient }, { signal }) {
    const loadedPatient = await Radio.request('entities', 'fetch:patients:model', patient.id, { signal });
    signal.throwIfAborted();
    await Promise.all(getPatientSidebarRequests(loadedPatient, this.sidebars, { signal }));

    return loadedPatient;
  },
  onStart(app, options, loadedPatient) {
    this.patient = loadedPatient;
    this.getView().showSidebars(this.sidebars);
  },
  focusClose() {
    this.getView()?.focusClose();
  },
});
