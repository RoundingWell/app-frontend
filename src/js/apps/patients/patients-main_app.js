import { get } from 'underscore';
import { Radio } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

import { addError } from 'js/datadog';
import handleErrors from 'js/utils/handle-errors';

import PatientApp from 'js/apps/patients/patient/patient_app';
import WorklistApp from 'js/apps/patients/worklist/worklist_app';
import ScheduleApp from 'js/apps/patients/schedule/schedule_app';

const WORKLISTS = {
  'owned-by': 'ownedBy',
  'shared-by': 'forTeam',
  'new-past-day': 'newPastDay',
  'updated-past-three-days': 'pastThree',
  'done-last-thirty-days': 'lastThirty',
};

export default ChildAppSwitcher.extend({
  childApps: {
    patient: PatientApp,
    ownedBy: WorklistApp,
    forTeam: WorklistApp,
    newPastDay: WorklistApp,
    pastThree: WorklistApp,
    lastThirty: WorklistApp,
    schedule: ScheduleApp,
  },

  onCleanupError: addError,

  onStop() {
    this.clearCurrentPatient();
  },

  clearCurrentPatient() {
    Radio.trigger('dialer', 'change:currentPatientId', null);
  },

  showRoute(match) {
    if (match.params.patientId) return this.showPatient(match);

    return this.showList(match).catch(handleErrors);
  },

  showList(match) {
    const region = this.getRegion();
    const { worklistId } = match.params;

    this.clearCurrentPatient();

    if (match.name === 'schedule') return this.switchTo('schedule', { signal: match.signal, reconstruct: true, options: { region } });

    if (!WORKLISTS[worklistId]) {
      Radio.trigger('event-router', 'notFound');
      return Promise.resolve();
    }

    return this.switchTo(WORKLISTS[worklistId], {
      signal: match.signal,
      reconstruct: true,
      options: { worklistId, clinicianId: match.info?.worklist?.clinicianId, region },
    });
  },

  // Shell (the patient) first, then the page the match selects
  async showPatient(match) {
    const { patientId } = match.params;

    Radio.trigger('dialer', 'change:currentPatientId', patientId);

    // The fetch layer presents every other failure
    const patientApp = await this.switchTo('patient', {
      signal: match.signal,
      key: { patientId },
      options: { patientId, region: this.getRegion() },
    }).catch(error => {
      if (get(error, ['response', 'status']) === 410) {
        Radio.trigger('event-router', 'notFound');
        return;
      }
      return handleErrors(error);
    });

    if (!patientApp) return;

    return patientApp.showRoute(match);
  },
});
