import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import PatientSidebarApp, { getPatientSidebarRequests } from 'js/apps/patients/patient/sidebar/sidebar_app';
import { SidebarLoadingView, SidebarView } from 'js/apps/patients/patient/sidebar/sidebar_views';

export default App.extend({
  onBeforeStart(app, { patient }) {
    this.patient = patient;

    const view = this.setView(new SidebarView({
      model: patient,
      isClosable: true,
      isListSidebar: true,
    })).render();

    this.listenTo(view, {
      'click:close': this.onClickClose,
      'click:patient': this.onClickPatient,
    });

    view.showChildView('sidebars', new SidebarLoadingView());
    this.showView();

    this.addChildApp('patientSidebar', new PatientSidebarApp({
      region: this.getRegion(),
    }));

    this.listenTo(this.getChildApp('patientSidebar'), 'close', () => {
      this.trigger('close');
    });
  },
  async prepareStart({ patient }) {
    return Radio.request('entities', 'fetch:patients:model', patient.id)
      .then(loadedPatient => {
        const sidebars = Radio.request('sidebars', 'patient');

        return Promise.all(getPatientSidebarRequests(loadedPatient, sidebars))
          .then(() => loadedPatient);
      })
      .then(async loadedPatient => {
        await this.getChildApp('patientSidebar').start({
          patient: loadedPatient,
          isClosable: true,
          isListSidebar: true,
          isPreloaded: true,
        });

        return loadedPatient;
      });
  },
  prepareStop(options) {
    return this.removeChildApp('patientSidebar', options);
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
  onFail(error) {
    this.trigger('close');

    if (error?.responseData) {
      Radio.request('alert', 'show:apiError', error.responseData);
      return;
    }

    addError(error);
  },
});
