import { get } from 'underscore';
import { Radio } from 'marionette';
import handleErrors from 'js/utils/handle-errors';

import RouteApp from 'js/base/route-app';

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

const isGone = error => get(error, ['response', 'status']) === 410;

function requireWorklist({ params }) {
  return WORKLISTS[params.worklistId] ?
    null :
    {
      name: 'notFound',
      query: {},
      hash: '',
    };
}

function failResolvedRoute(error, signal) {
  if (signal.aborted) return;

  if (get(error, ['response', 'status']) === 410) {
    Radio.trigger('event-router', 'notFound');
    return;
  }

  return handleErrors(error).catch(reportedError => window.reportError(reportedError));
}

// Legacy resource lookup failures use the existing root error routes
function redirectFlow(name) {
  return ({ params }, { signal }) => {
    return Radio.request('entities', 'fetch:flows:model', params.flowId, {
      signal,
    })
      .then(flow => ({
        name,
        params: {
          ...params,
          patientId: flow.getPatient().id,
        },
        query: {},
        hash: '',
      }))
      .catch(error => failResolvedRoute(error, signal));
  };
}

export default RouteApp.extend({
  childApps: {
    patient: PatientApp,
    ownedBy: WorklistApp,
    forTeam: WorklistApp,
    newPastDay: WorklistApp,
    pastThree: WorklistApp,
    lastThirty: WorklistApp,
    schedule: ScheduleApp,
  },

  routes: {
    'worklist/:worklistId': {
      name: 'worklist',
      handler: 'showWorklist',
      redirect: requireWorklist,
      meta: {
        isList: true,
      },
    },
    'schedule': {
      name: 'schedule',
      handler: 'showSchedule',
      meta: {
        isList: true,
      },
    },
    'patient/:patientId': {
      mount: 'patient',
      namespace: 'patient',
    },
    // Retained through 2027-09-02
    'patient/dashboard/:patientId': {
      name: 'patient:workflow:alias:0',
      redirect: {
        name: 'patient:workflow',
      },
    },
    'patient/archive/:patientId': {
      name: 'patient:workflow:closed:alias:0',
      redirect: {
        name: 'patient:workflow:closed',
      },
    },
    'patient/archive/:patientId/action/:actionId': {
      name: 'patient:action:alias:0',
      redirect: {
        name: 'patient:action',
      },
    },
    'flow/:flowId': {
      name: 'legacy:patient:flow',
      redirect: redirectFlow('patient:flow'),
      meta: {
        clearArea: true,
      },
    },
    'flow/:flowId/details': {
      name: 'legacy:patient:flow:alias:0',
      redirect: {
        name: 'legacy:patient:flow',
      },
    },
    'flow/:flowId/action/:actionId': {
      name: 'legacy:patient:flow:action',
      redirect: redirectFlow('patient:flow:action'),
      meta: {
        clearArea: true,
      },
    },
  },

  onStop() {
    Radio.trigger('dialer', 'change:currentPatientId', null);
  },

  showWorklist(match) {
    Radio.trigger('dialer', 'change:currentPatientId', null);
    const { worklistId } = match.params;

    return this.switchTo(WORKLISTS[worklistId], {
      signal: match.signal,
      restart: true,
      options: {
        region: this.getRegion(),
        worklistId,
        clinicianId: match.info?.worklist?.clinicianId,
      },
    }).catch(handleErrors);
  },

  showSchedule(match) {
    Radio.trigger('dialer', 'change:currentPatientId', null);
    return this.switchTo('schedule', {
      signal: match.signal,
      restart: true,
      options: {
        region: this.getRegion(),
      },
    }).catch(handleErrors);
  },

  onBeforeRoute(match) {
    if (match.params.patientId) Radio.trigger('dialer', 'change:currentPatientId', match.params.patientId);
  },

  // The fetch layer presents every failure other than a removed patient
  handleRouteError(error, match, { phase }) {
    if (phase !== 'start') throw error;
    if (isGone(error)) {
      Radio.trigger('event-router', 'notFound');
      return;
    }
    return handleErrors(error);
  },
});
