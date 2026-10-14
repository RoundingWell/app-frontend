import { get } from 'underscore';
import { Radio } from 'marionette';

import handleErrors from 'js/utils/handle-errors';

import RouterApp from 'js/base/routerapp';

import PatientApp from 'js/apps/patients/patient/patient_app';
import WorklistApp from 'js/apps/patients/worklist/worklist_app';
import ScheduleApp from 'js/apps/patients/schedule/schedule_app';

export default RouterApp.extend({
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
    'worklist': { action: 'showPatientsWorklist' },
    'schedule': { action: 'showSchedule' },
    'patient:workflow': { action: 'showPatient' },
    'patient:workflow:closed': { action: 'showPatient' },
    'patient:interactions': { action: 'showPatient' },
    'patient:interaction': { action: 'showPatient' },
    'patient:action': { action: 'showPatient' },
    'patient:flow': { action: 'showPatient' },
    'patient:flow:focus': { action: 'showPatient' },
    'patient:flow:action': { action: 'showPatient' },
    'patient:form': { action: 'showPatient' },
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
});
