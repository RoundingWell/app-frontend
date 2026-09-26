import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import createLatestRequest from 'js/utils/latest-request';
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
  onBeforeStart(app, { region, filtersState, layoutState, isDrawer }) {
    this.releaseHost();
    this.hasHost = true;
    this.sidebarRegion = region;
    this.filtersState = filtersState;
    this.layoutState = layoutState;
    this.isDrawer = isDrawer;
    this.patient = null;
    this.requests = createLatestRequest({
      load: (patient, context) => this.showSidebar(patient, context),
      fail: (error, patient) => this.handleSidebarError(error, patient),
      commit: (shown, patient) => {
        if (shown && !patient) this.triggerMethod('show:filters');
      },
    });
  },
  prepareStart(options, { signal }) {
    return this.requests.run(null, { signal });
  },
  onStop() {
    this.releaseHost();
    this.patient = null;
  },
  onBeforeDestroy() {
    this.releaseHost();
  },
  releaseHost() {
    this.hasHost = false;
    this.requests?.dispose();
  },
  isPatientOpen() {
    return !!this.patient;
  },
  setDrawerMode(isDrawer) {
    this.isDrawer = isDrawer;
    this.getChildApp('filters').getView()?.setDrawerMode(isDrawer);
  },
  showControls(view) {
    this.getChildApp('filters').getView().showChildView('controls', view);
  },
  focusPatientClose() {
    this.getChildApp('patient').focusClose();
  },
  closePatient() {
    return this.showFilters()
      .then(shown => {
        if (shown) this.triggerMethod('close');
        return shown;
      })
      .catch(addError);
  },
  async showSidebar(patient, { signal }) {
    const filtersStopped = await this.getChildApp('filters').stop();
    signal.throwIfAborted();
    // Replacement requests abort above; filters have no independent stop veto.
    /* istanbul ignore if */
    if (!filtersStopped) return false;
    const patientStopped = await this.getChildApp('patient').stop();
    signal.throwIfAborted();
    // Replacement requests abort above; patient sidebars have no independent stop veto.
    /* istanbul ignore if */
    if (!patientStopped) return false;

    if (patient) {
      return this.getChildApp('patient').start({ patient, region: this.sidebarRegion });
    }

    return this.getChildApp('filters').start({
      filtersState: this.filtersState,
      layoutState: this.layoutState,
      isDrawer: this.isDrawer,
      region: this.sidebarRegion,
    });
  },
  selectPatient(patient) {
    // The page removes UI event sources on release; guard already-queued callbacks.
    /* istanbul ignore if */
    if (!this.hasHost) return Promise.resolve(false);
    if (this.patient?.id === patient.id) return this.closePatient();

    this.patient = patient;
    this.triggerMethod('change:patient', patient);
    return this.requests.run(patient);
  },
  handleSidebarError(error, patient) {
    // Filter startup is synchronous; only programmer errors can reject it.
    /* istanbul ignore if */
    if (!patient) throw error;

    this.showFilters().catch(addError);
    if (error?.responseData) Radio.request('alert', 'show:apiError', error.responseData);
    else addError(error);
  },
  showFilters() {
    // The page removes UI event sources on release; guard already-queued callbacks.
    /* istanbul ignore if */
    if (!this.hasHost) return Promise.resolve(false);
    this.patient = null;
    this.triggerMethod('change:patient', null);
    return this.requests.run(null)
      .then(committed => committed && !this.patient && this.getChildApp('filters').isRunning());
  },
});
