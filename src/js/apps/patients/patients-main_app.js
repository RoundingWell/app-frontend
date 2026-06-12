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
        'patient/:id/workflow',
        'patient/dashboard/:id',
      ],
    },
    'patient:workflow:closed': {
      action: 'showPatient',
      route: [
        'patient/:id/workflow/closed',
        'patient/archive/:id',
      ],
    },
    'patient:action': {
      action: 'showPatient',
      route: [
        'patient/:id/action/:id',
        'patient/archive/:id/action/:id',
      ],
    },
    'patient:flow': {
      action: 'showPatient',
      route: 'patient/:id/flow/:id',
    },
    'patient:flow:action': {
      action: 'showPatient',
      route: 'patient/:id/flow/:id/action/:id',
    },
    'patient:form': {
      action: 'showPatient',
      route: 'patient/:id/form/:id',
    },
    'patient:form:action': {
      action: 'showPatient',
      route: 'patient/:id/form/:id/action/:id',
    },

    // Legacy routes without a patient ID cannot be aliases. Their handlers
    // resolve the patient and replace the URL with its canonical equivalent.
    'flow': {
      action: 'redirectLegacyFlow',
      route: [
        'flow/:id',
        'flow/:id/details',
      ],
    },
    'flow:action': {
      action: 'redirectLegacyFlowAction',
      route: 'flow/:id/action/:id',
    },
    'form:patientAction': {
      action: 'redirectLegacyActionForm',
      route: 'patient-action/:id/form/:id',
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

  redirectLegacyFlow(flowId) {
    this.resolveLegacyFlow('patient:flow', flowId);
  },

  redirectLegacyFlowAction(flowId, actionId) {
    this.resolveLegacyFlow('patient:flow:action', flowId, actionId);
  },

  redirectLegacyActionForm(actionId, formId) {
    const sourceRoute = this.getCurrentRoute();

    Radio.request('entities', 'fetch:actions:model', actionId)
      .then(action => {
        const patientId = action.getPatient().id;
        this.redirectRoute(sourceRoute, 'patient:form:action', patientId, formId, actionId);
      })
      .catch(error => this.failLegacyRoute(sourceRoute, error));
  },

  resolveLegacyFlow(event, flowId, actionId) {
    const sourceRoute = this.getCurrentRoute();

    Radio.request('entities', 'fetch:flows:model', flowId)
      .then(flow => {
        const patientId = flow.getPatient().id;
        const routeArgs = actionId ?
          [patientId, flowId, actionId] :
          [patientId, flowId];

        this.redirectRoute(sourceRoute, event, ...routeArgs);
      })
      .catch(error => this.failLegacyRoute(sourceRoute, error));
  },

  redirectRoute(sourceRoute, event, ...eventArgs) {
    // Ignore a resolver that completed after the user navigated elsewhere.
    if (this.getCurrentRoute() !== sourceRoute) return;

    this.replaceRoute(event, ...eventArgs);
    Radio.trigger('event-router', event, ...eventArgs);
  },

  failLegacyRoute(sourceRoute, error) {
    if (this.getCurrentRoute() !== sourceRoute) return;

    if (get(error, ['response', 'status']) === 410) {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    handleErrors(error);
  },
});
