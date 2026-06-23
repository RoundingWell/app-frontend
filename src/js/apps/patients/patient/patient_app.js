import { partial, get, noop } from 'underscore';
import Radio from 'backbone.radio';

import handleErrors from 'js/utils/handle-errors';

import SubRouterApp from 'js/base/subrouterapp';

import DashboardApp from 'js/apps/patients/patient/dashboard/dashboard_app';
import ArchiveApp from 'js/apps/patients/patient/archive/archive_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import ActionSiderbarApp from 'js/apps/patients/sidebar/action/action-sidebar_app';

import { LayoutView, intl } from 'js/apps/patients/patient/patient_views';

export default SubRouterApp.extend({
  routeScope: ['patientId'],

  routeActions() {
    return {
      'patient:dashboard': partial(this.startList, 'dashboard'),
      'patient:archive': partial(this.startList, 'archive'),
      'patient:action': partial(this.startPatientAction, 'dashboard'),
      'patient:action:archive': partial(this.startPatientAction, 'archive'),
    };
  },

  childApps: {
    dashboard: DashboardApp,
    archive: ArchiveApp,
    actionSidebar: ActionSiderbarApp,
    patient: PatientSidebarApp,
  },

  currentAppOptions() {
    return {
      region: this.getRegion('content'),
      patient: this.getOption('patient'),
    };
  },

  onBeforeStartRoute() {
    if (this.action) {
      this.action.trigger('editing', false);
      delete this.action;
    }
  },

  onBeforeStart() {
    this.getRegion().startPreloader();
  },

  beforeStart() {
    const [patientId, actionId] = this.getCurrentRoute().eventArgs;

    return [
      Radio.request('entities', 'fetch:patients:model', patientId),
      // the action is a non-aborting prefetch: it warms the cache for the initial
      // route but its failure must never reject startup or override a newer route —
      // dispatch (startPatientAction) is the source of truth and handles errors
      actionId && Radio.request('entities', 'fetch:actions:model', actionId).catch(noop),
    ];
  },

  /* istanbul ignore next: beforeStart error handling */
  onFail(options, error) {
    // the action prefetch is non-aborting, so a startup failure is the patient's;
    // a 410 means the patient is gone
    if (get(error, ['response', 'status']) === 410) {
      Radio.trigger('event-router', 'notFound');
      this.stop();
      return;
    }

    handleErrors(error);
  },

  // status-aware action failure handling for the on-demand dispatch fetch
  failAction(error, patientId) {
    /* istanbul ignore else: only the 410 path is exercised; others are generic */
    if (get(error, ['response', 'status']) === 410) {
      this.showActionNotFound();
      this.stop();
      Radio.trigger('event-router', 'patient:dashboard', patientId);
      return;
    }

    /* istanbul ignore next: generic error handling */
    handleErrors(error);
  },

  onStart(options, patient) {
    this.patient = patient;

    this.setView(new LayoutView({ model: patient }));

    this.showSidebar();

    this.startCurrentRoute();

    this.showView();
  },

  onStop() {
    delete this._list;
    delete this.action;
  },

  showActionNotFound() {
    Radio.request('alert', 'show:error', intl.actionNotFound);
  },

  startList(list) {
    if (this._list === list) return;

    this._list = list;

    this.startCurrent(list);

    if (this.action) {
      this.listenToOnce(this.getChildApp(list), 'start', () => {
        this.action.trigger('editing', true);
      });
    }
  },

  startPatientAction(list, patientId, actionId) {
    const action = Radio.request('entities', 'actions:model', actionId);
    this.action = action;

    this.startList(list);

    this.getChildApp('actionSidebar').stop();

    if (action.isCached()) {
      this.showActionSidebar(action, list, patientId);
      return;
    }

    // not cached when its route coalesced into a still-loading PatientApp, the
    // prefetch failed, or the action is absent from the list: fetch it on demand
    // rather than reporting it missing
    Radio.request('entities', 'fetch:actions:model', actionId)
      .then(() => this.showActionSidebar(action, list, patientId))
      .catch(error => {
        // suppress when a newer action route superseded this one (or the app stopped)
        if (this.action !== action) return;

        this.failAction(error, patientId);
      });
  },

  showActionSidebar(action, list, patientId) {
    // a newer action route may have superseded this one while it loaded
    if (this.action !== action) return;

    /* istanbul ignore next: defensive — app stopped mid-fetch */
    if (!this.isRunning()) return;

    const sidebarApp = this.getChildApp('actionSidebar');

    Radio.request('sidebar', 'start', sidebarApp, { action });

    // re-dispatched routes must not accumulate close handlers on the singleton
    this.stopListening(sidebarApp, 'close');
    this.listenTo(sidebarApp, 'close', () => {
      Radio.trigger('event-router', `patient:${ list }`, patientId);
    });
  },

  showSidebar() {
    this.startChildApp('patient', {
      region: this.getRegion('sidebar'),
      patient: this.patient,
    });
  },
});
