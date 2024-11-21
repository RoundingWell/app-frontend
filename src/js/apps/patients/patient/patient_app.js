import { partial, some, get } from 'underscore';
import Radio from 'backbone.radio';

import SubRouterApp from 'js/base/subrouterapp';

import DashboardApp from 'js/apps/patients/patient/dashboard/dashboard_app';
import ArchiveApp from 'js/apps/patients/patient/archive/archive_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import ActionSiderbarApp from 'js/apps/patients/sidebar/action-sidebar_app';

import { LayoutView, intl } from 'js/views/patients/patient/patient_views';

export default SubRouterApp.extend({
  eventRoutes() {
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

  onBeforeStart() {
    this.getRegion().startPreloader();
  },

  beforeStart({ currentRoute: { eventArgs: [patientId, actionId] } }) {
    return [
      Radio.request('entities', 'fetch:patients:model', patientId),
      actionId && Radio.request('entities', 'fetch:actions:model', actionId),
    ];
  },

  onFail({ currentRoute: { eventArgs: [patientId] } }, { response = {}, responseData = {} }) {
    /* istanbul ignore else: other error scenarios handled elsewhere */
    if (response.status === 410) {
      if (!some(responseData.errors, error => {
        return get(error, ['source', 'parameter']) === 'actionId';
      })) {
        Radio.trigger('event-router', 'notFound');
        this.stop();
        return;
      }

      Radio.request('alert', 'show:error', intl.actionNotFound);
      this.stop();
      Radio.trigger('event-router', 'patient:dashboard', patientId);
      return;
    }

    /* eslint-disable no-console */
    console.error(arguments);
  },

  onStart({ currentRoute }, patient) {
    this.patient = patient;

    this.setView(new LayoutView({ model: patient }));

    this.showSidebar();

    this.startRoute(currentRoute);

    this.showView();
  },

  onStop() {
    delete this._list;
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
    this.action = Radio.request('entities', 'actions:model', actionId);

    this.startList(list);

    const sidebarApp = this.getChildApp('actionSidebar');

    sidebarApp.stop();

    Radio.request('sidebar', 'start', sidebarApp, { action: this.action });

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
