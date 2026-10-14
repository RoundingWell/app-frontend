import { get } from 'underscore';
import { Radio } from 'marionette';

import handleErrors from 'js/utils/handle-errors';

import RouterApp from 'js/base/routerapp';

import PatientApp from 'js/apps/patients/patient/patient_app';
import WorklistApp from 'js/apps/patients/worklist/worklist_app';
import ScheduleApp from 'js/apps/patients/schedule/schedule_app';

// End of the compatibility window for the legacy dashboard/archive aliases
const LEGACY_ALIAS_UNTIL = '2027-09-02';

export default RouterApp.extend({
  routerAppName: 'PatientsApp',
  childApps: {
    patient: PatientApp,
    ownedBy: WorklistApp,
    forTeam: WorklistApp,
    newPastDay: WorklistApp,
    pastThree: WorklistApp,
    lastThirty: WorklistApp,
    schedule: ScheduleApp,
  },

  eventRoutes: {
    'worklist': {
      action: 'showPatientsWorklist',
      route: 'worklist/:id',
      meta: { isList: true },
    },
    'schedule': {
      action: 'showSchedule',
      route: 'schedule',
      meta: { isList: true },
    },
    // Canonical patient-workspace routes. Every route starts the same PatientApp;
    // PatientApp dispatches the page while its patient shell remains attached.
    // The dashboard/archive aliases below are bookmark compatibility only and
    // are supported until September 2, 2027.
    'patient:workflow': {
      action: 'showPatient',
      route: [
        'patient/:patientId/workflow',
        { path: 'patient/dashboard/:patientId', until: LEGACY_ALIAS_UNTIL },
      ],
    },
    'patient:workflow:closed': {
      action: 'showPatient',
      route: [
        'patient/:patientId/workflow/closed',
        { path: 'patient/archive/:patientId', until: LEGACY_ALIAS_UNTIL },
      ],
    },
    'patient:interactions': {
      action: 'showPatient',
      route: 'patient/:patientId/interactions',
    },
    'patient:interaction': {
      action: 'showPatient',
      route: 'patient/:patientId/interactions/:interactionId',
    },
    'patient:action': {
      action: 'showPatient',
      route: [
        'patient/:patientId/action/:actionId',
        { path: 'patient/archive/:patientId/action/:actionId', until: LEGACY_ALIAS_UNTIL },
      ],
    },
    'patient:flow': {
      action: 'showPatient',
      route: 'patient/:patientId/flow/:flowId',
    },
    'patient:flow:focus': {
      action: 'showPatient',
      route: 'patient/:patientId/flow/:flowId/focus/:actionId',
    },
    'patient:flow:action': {
      action: 'showPatient',
      route: 'patient/:patientId/flow/:flowId/action/:actionId',
    },
    'patient:form': {
      action: 'showPatient',
      route: 'patient/:patientId/form/:formId',
    },
    'legacy:patient:flow': {
      redirect: 'redirectPatientFlow',
      route: [
        'flow/:flowId',
        'flow/:flowId/details',
      ],
    },
    'legacy:patient:flow:action': {
      redirect: 'redirectPatientFlowAction',
      route: 'flow/:flowId/action/:actionId',
    },
  },

  onStop() {
    this.clearCurrentPatient();
  },

  clearCurrentPatient() {
    Radio.trigger('dialer', 'change:currentPatientId', null);
  },

  showPatientsWorklist(worklistId, options) {
    this.clearCurrentPatient();

    const worklistsById = {
      'owned-by': 'ownedBy',
      'shared-by': 'forTeam',
      'new-past-day': 'newPastDay',
      'updated-past-three-days': 'pastThree',
      'done-last-thirty-days': 'lastThirty',
    };

    if (!worklistsById[worklistId]) {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    return this.startCurrent(worklistsById[worklistId], { worklistId, clinicianId: options?.clinicianId });
  },

  showSchedule() {
    this.clearCurrentPatient();

    return this.startCurrent('schedule');
  },

  showPatient(patientId) {
    Radio.trigger('dialer', 'change:currentPatientId', patientId);
    return this.startRoute('patient', { patientId });
  },
  onRouteError(error) {
    if (get(error, ['response', 'status']) === 410) {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    handleErrors(error).catch(reportedError => window.reportError(reportedError));
  },

  redirectPatientFlow({ params }, context) {
    return this.resolveFlowPatient('patient:flow', params, context);
  },

  redirectPatientFlowAction({ params }, context) {
    return this.resolveFlowPatient('patient:flow:action', params, context);
  },

  resolveFlowPatient(name, params, { signal }) {
    return Radio.request('entities', 'fetch:flows:model', params.flowId, { signal })
      .then(flow => ({ name, params: { ...params, patientId: flow.getPatient().id } }))
      .catch(error => this.failResolvedRoute(error, signal));
  },

  // The legacy URL stays in place and the error renders over it
  failResolvedRoute(error, signal) {
    if (signal.aborted) return;

    if (get(error, ['response', 'status']) === 410) {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    return handleErrors(error).catch(reportedError => window.reportError(reportedError));
  },
});
