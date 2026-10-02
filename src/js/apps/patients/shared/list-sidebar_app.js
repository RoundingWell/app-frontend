import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import App from 'js/base/app';

import { ListFiltersPanelApp } from './list-filters/list-filters_app';
import ListPatientSidebarApp from './list-patient-sidebar_app';

export default App.extend({
  childApps: {
    filters: ListFiltersPanelApp,
    patient: ListPatientSidebarApp,
  },
  initialize() {
    this.listenTo(this.getChildApp('patient'), {
      'close': this.closePatient,
      'show:sidebar': () => this.triggerMethod('show:patient'),
    });
  },
  onBeforeStart(app, { region, filtersState, layoutState, isDrawer, ControlsView, controlsOptions }) {
    if (this.hasHost) return;

    this.hasHost = true;
    this.sidebarRegion = region;
    this.filtersState = filtersState;
    this.layoutState = layoutState;
    this.isDrawer = isDrawer;
    this.ControlsView = ControlsView;
    this.controlsOptions = controlsOptions;
    this.patient = null;
  },
  prepareStart({ patient = null }, { signal }) {
    this.getChildApp('filters').stop();
    signal.throwIfAborted();
    this.getChildApp('patient').stop();
    signal.throwIfAborted();

    if (patient) {
      return this.getChildApp('patient').start({ patient, region: this.sidebarRegion });
    }

    const filters = this.getChildApp('filters');
    filters.start({
      filtersState: this.filtersState,
      layoutState: this.layoutState,
      isDrawer: this.isDrawer,
      ControlsView: this.ControlsView,
      controlsOptions: this.controlsOptions,
      region: this.sidebarRegion,
    }).catch(addError);
    this.triggerMethod('show:filters');
  },
  onStop() {
    this.hasHost = false;
    this.patient = null;
  },
  isPatientOpen() {
    return !!this.patient;
  },
  setDrawerMode(isDrawer) {
    this.isDrawer = isDrawer;
    this.getChildApp('filters').getView()?.setDrawerMode(isDrawer);
  },
  focusPatientClose() {
    this.getChildApp('patient').focusClose();
  },
  closePatient() {
    this.showFilters();
    this.triggerMethod('close');
  },
  selectPatient(patient) {
    if (this.patient?.id === patient.id) return this.closePatient();

    this.patient = patient;
    this.triggerMethod('change:patient', patient);
    return this.restart({ patient }).catch(error => {
      this.handleSidebarError(error);
      return false;
    });
  },
  handleSidebarError(error) {
    this.showFilters();
    if (error?.responseData) Radio.request('alert', 'show:apiError', error.responseData);
    else addError(error);
  },
  showFilters() {
    this.patient = null;
    this.triggerMethod('change:patient', null);
    this.restart({ patient: null }).catch(addError);
  },
});
