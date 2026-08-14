import { get } from 'underscore';
import Radio from 'backbone.radio';

import handleErrors from 'js/utils/handle-errors';

import RouterApp from 'js/base/routerapp';

import PatientApp from 'js/apps/patients/patient/patient_app';
import WorklistApp from 'js/apps/patients/worklist/worklist_app';
import ScheduleApp from 'js/apps/patients/schedule/schedule_app';

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
    // PatientApp dispatches the page while its patient shell remains mounted.
    'patient:workflow': {
      action: 'showPatient',
      route: [
        'patient/:patientId/workflow',
        'patient/dashboard/:patientId',
      ],
    },
    'patient:workflow:closed': {
      action: 'showPatient',
      route: [
        'patient/:patientId/workflow/closed',
        'patient/archive/:patientId',
      ],
    },
    'patient:action': {
      action: 'showPatient',
      route: [
        'patient/:patientId/action/:actionId',
        'patient/archive/:patientId/action/:actionId',
      ],
    },
    'patient:action:form': {
      action: 'showPatient',
      route: 'patient/:patientId/action/:actionId/form',
    },
    'patient:flow': {
      action: 'showPatient',
      route: 'patient/:patientId/flow/:flowId',
    },
    'patient:flow:action': {
      action: 'showPatient',
      route: 'patient/:patientId/flow/:flowId/action/:actionId',
    },
    'patient:flow:action:form': {
      action: 'showPatient',
      route: 'patient/:patientId/flow/:flowId/action/:actionId/form',
    },
    'patient:form': {
      action: 'showPatient',
      route: 'patient/:patientId/form/:formId',
    },
    'legacy:patient:flow': {
      action: 'redirectPatientFlow',
      route: [
        'flow/:flowId',
        'flow/:flowId/details',
      ],
    },
    'legacy:patient:flow:action': {
      action: 'redirectPatientFlowAction',
      route: 'flow/:flowId/action/:actionId',
    },
  },

  onStop() {
    this.clearCurrentPatient();
  },

  clearCurrentPatient() {
    Radio.trigger('dialer', 'change:currentPatientId', null);
  },

  showPatientsWorklist(worklistId, clinicianId) {
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

    this.startCurrent(worklistsById[worklistId], { worklistId, clinicianId });
  },

  showSchedule() {
    this.clearCurrentPatient();
    this.startCurrent('schedule');
  },

  showPatient(patientId) {
    Radio.trigger('dialer', 'change:currentPatientId', patientId);
    this.startRoute('patient', { patientId });
  },

  redirectPatientFlow(flowId) {
    return this.resolveFlowPatient('patient:flow', flowId);
  },

  redirectPatientFlowAction(flowId, actionId) {
    return this.resolveFlowPatient('patient:flow:action', flowId, actionId);
  },

  resolveFlowPatient(event, flowId, actionId) {
    const sourceRoute = this.getCurrentRoute();

    return Radio.request('entities', 'fetch:flows:model', flowId)
      .then(flow => {
        const patientId = flow.getPatient().id;
        const routeArgs = actionId ?
          [patientId, flowId, actionId] :
          [patientId, flowId];

        this.redirectResolvedRoute(sourceRoute, event, ...routeArgs);
      })
      .catch(error => this.failResolvedRoute(sourceRoute, error));
  },

  redirectResolvedRoute(sourceRoute, event, ...eventArgs) {
    // Ignore a resolver that completed after the user navigated elsewhere.
    if (!this.isRunning() || this.getCurrentRoute() !== sourceRoute) return;

    // Replace the legacy URL without dispatching, then route the canonical event.
    this.replaceRoute(event, ...eventArgs);
    Radio.trigger('event-router', event, ...eventArgs);
  },

  failResolvedRoute(sourceRoute, error) {
    if (!this.isRunning() || this.getCurrentRoute() !== sourceRoute) return;

    if (get(error, ['response', 'status']) === 410) {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    return handleErrors(error);
  },
});
