import Radio from 'backbone.radio';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import PatientSidebarApp, { getPatientSidebarRequests } from 'js/apps/patients/patient/sidebar/sidebar_app';
import { SidebarLoadingView, SidebarView } from 'js/apps/patients/patient/sidebar/sidebar_views';

export default App.extend({
  childApps: {
    patientSidebar: PatientSidebarApp,
  },
  onBeforeStart({ patient }) {
    this.patient = patient;

    const loadingView = new SidebarView({
      model: patient,
      isClosable: true,
      isListSidebar: true,
    });

    this.listenTo(loadingView, {
      'click:close': this.onClickClose,
      'click:patient': this.onClickPatient,
    });

    this.getRegion().show(loadingView);
    loadingView.showChildView('sidebars', new SidebarLoadingView());
  },
  beforeStart({ patient }) {
    return Radio.request('entities', 'fetch:patients:model', patient.id)
      .then(loadedPatient => {
        const sidebars = Radio.request('sidebars', 'patient');

        return Promise.all(getPatientSidebarRequests(loadedPatient, sidebars))
          .then(() => loadedPatient);
      });
  },
  onStart(options, patient) {
    const patientSidebar = this.startChildApp('patientSidebar', {
      region: this.getRegion(),
      patient,
      isClosable: true,
      isListSidebar: true,
      isPreloaded: true,
    });

    this.listenTo(patientSidebar, 'close', () => {
      this.trigger('close');
    });
  },
  focusClose() {
    this.getRegion().currentView?.focusClose();
  },
  onClickClose() {
    this.trigger('close');
  },
  onClickPatient() {
    Radio.trigger('event-router', 'patient:workflow', this.patient.id);
  },
  onFail(options, error) {
    this.trigger('close');

    if (error?.responseData) {
      Radio.request('alert', 'show:apiError', error.responseData);
      return;
    }

    addError(error);
  },
});
