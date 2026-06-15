import Radio from 'backbone.radio';

import RouterApp from 'js/base/routerapp';

import FlowApp from 'js/apps/patients/patient/flow/flow_app';
import PatientApp from 'js/apps/patients/patient/patient_app';
import WorklistApp from 'js/apps/patients/worklist/worklist_app';
import ScheduleApp from 'js/apps/patients/schedule/schedule_app';

export default RouterApp.extend({
  routerAppName: 'PatientsApp',

  childApps: {
    flow: FlowApp,
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
    'patient:dashboard': {
      action: 'showPatient',
      route: 'patient/dashboard/:id',
    },
    'patient:archive': {
      action: 'showPatient',
      route: 'patient/archive/:id',
    },
    'patient:action': {
      action: 'showPatient',
      route: 'patient/:id/action/:id',
    },
    'patient:action:archive': {
      action: 'showPatient',
      route: 'patient/archive/:id/action/:id',
    },
    'flow': {
      action: 'showFlow',
      route: 'flow/:id',
    },
    'flow:details': {
      action: 'showFlow',
      route: 'flow/:id/details',
    },
    'flow:action': {
      action: 'showFlow',
      route: 'flow/:id/action/:id',
    },
    'schedule': {
      action: 'showSchedule',
      route: 'schedule',
      meta: { isList: true },
    },
  },

  onBeforeAppRoute(router, { event, eventArgs: [patientId] }) {
    // if routing to flow route, currentPatientId is set by flow_app's onStart()
    if (event.startsWith('flow')) return;

    // determines if dialer patient buttons are shown or hidden
    const isPatientRoute = event.startsWith('patient');
    Radio.trigger('dialer', 'change:currentPatientId', isPatientRoute ? patientId : null);
  },

  onStop() {
    Radio.trigger('dialer', 'change:currentPatientId', null);
  },

  showPatient(patientId) {
    this.startRoute('patient', { patientId });
  },

  showPatientsWorklist(worklistId, clinicianId) {
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

  showFlow(flowId) {
    this.startRoute('flow', { flowId });
  },

  showSchedule() {
    this.startCurrent('schedule');
  },
});
