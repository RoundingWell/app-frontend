import { get } from 'underscore';
import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

import { addError } from 'js/datadog';

import App from 'js/base/app';

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

export default App.extend({
  childApps: {
    patient: PatientApp,
    ownedBy: WorklistApp,
    forTeam: WorklistApp,
    newPastDay: WorklistApp,
    pastThree: WorklistApp,
    lastThirty: WorklistApp,
    schedule: ScheduleApp,
  },

  initialize() {
    this.pages = new RouteOutlet({ owner: this, onCleanupError: addError });
  },

  onStop() {
    this.clearCurrentPatient();
  },

  clearCurrentPatient() {
    Radio.trigger('dialer', 'change:currentPatientId', null);
  },

  showRoute(match) {
    // The fetch layer presents every other failure
    return this.showPage(match).catch(error => {
      if (get(error, ['response', 'status']) === 410) Radio.trigger('event-router', 'notFound');
    });
  },

  showPage(match) {
    const region = this.getRegion();
    const { patientId, worklistId } = match.params;

    if (match.name === 'schedule') {
      this.clearCurrentPatient();

      return this.pages.show('schedule', { match, restart: true, options: { region } });
    }

    if (match.name === 'worklist') {
      this.clearCurrentPatient();

      if (!WORKLISTS[worklistId]) {
        Radio.trigger('event-router', 'notFound');
        return Promise.resolve();
      }

      return this.pages.show(WORKLISTS[worklistId], {
        match,
        restart: true,
        options: { worklistId, clinicianId: match.query.get('clinicianId'), region },
      });
    }

    Radio.trigger('dialer', 'change:currentPatientId', patientId);

    return this.pages.show('patient', { key: { patientId }, match, options: { patientId, region } });
  },
});
