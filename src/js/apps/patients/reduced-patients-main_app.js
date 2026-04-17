import Radio from 'backbone.radio';

import RouterApp from 'js/base/routerapp';

import FlowApp from 'js/apps/patients/patient/flow/flow_app';
import PatientApp from 'js/apps/patients/patient/patient_app';
import ReducedScheduleApp from 'js/apps/patients/schedule/reduced-schedule/reduced_schedule_app';

export default RouterApp.extend({
  routerAppName: 'PatientsApp',
  childApps() {
    return {
      flow: FlowApp,
      patient: PatientApp,
      schedule: ReducedScheduleApp,
    };
  },

  eventRoutes: {
    'schedule': {
      action: 'showSchedule',
      route: 'schedule',
      isList: true,
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
  },

  onBeforeAppRoute(event, patientId) {
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
  showFlow(flowId) {
    this.startRoute('flow', { flowId });
  },
  showSchedule() {
    this.startCurrent('schedule');
  },
});
