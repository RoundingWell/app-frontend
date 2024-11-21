import { partial } from 'underscore';
import Radio from 'backbone.radio';

import SubRouterApp from 'js/base/subrouterapp';

import DashboardApp from 'js/apps/patients/patient/dashboard/dashboard_app';
import ArchiveApp from 'js/apps/patients/patient/archive/archive_app';
import ActionApp from 'js/apps/patients/patient/action/action_app';
import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';

import { LayoutView } from 'js/views/patients/patient/patient_views';

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
    action: ActionApp,
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

  beforeStart({ patientId }) {
    return Radio.request('entities', 'fetch:patients:model', patientId);
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

  startPatientAction(patientId, actionId) {
    const actionApp = this.getChildApp('action');

    this.listenToOnce(actionApp, {
      'start'(options, action) {
        this.editActionList(action);
      },
      'fail'() {
        this.startCurrent('dashboard');
      },
    });

    this.startChildApp('action', { actionId, patientId });
  },

  startActionList(action) {
    if (action.isDone()) return this.startCurrent('archive');

    return this.startCurrent('dashboard');
  },

  // Triggers event on started action list for marking the edited action
  editActionList(action) {
    const currentActionList = this.getCurrent() || this.startActionList(action);

    if (!currentActionList.isRunning()) {
      this.listenToOnce(currentActionList, 'start', () => {
        action.trigger('editing', true);
      });
      return;
    }

    action.trigger('editing', true);
  },

  showSidebar() {
    this.startChildApp('patient', {
      region: this.getRegion('sidebar'),
      patient: this.patient,
    });
  },
});
