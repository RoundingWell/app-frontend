import { get } from 'underscore';
import { Radio } from 'marionette';

import handleErrors from 'js/utils/handle-errors';

// End of the compatibility window for the legacy dashboard/archive aliases
const LEGACY_ALIAS_UNTIL = '2027-09-02';

function defaultList(workspace) {
  return { name: 'worklist', params: { workspace, worklistId: 'owned-by' } };
}

function failResolvedRoute(error, signal) {
  if (signal.aborted) return;

  if (get(error, ['response', 'status']) === 410) {
    Radio.trigger('event-router', 'notFound');
    return;
  }

  return handleErrors(error).catch(reportedError => window.reportError(reportedError));
}

// The legacy URL stays in place and the error renders over it
function redirectFlow(name) {
  return ({ params }, { signal }) => {
    return Radio.request('entities', 'fetch:flows:model', params.flowId, { signal })
      .then(flow => ({ name, params: { ...params, patientId: flow.getPatient().id } }))
      .catch(error => failResolvedRoute(error, signal));
  };
}

export default [
  {
    name: 'root',
    path: '/',
    redirect: () => defaultList(Radio.request('workspace', 'current').get('slug')),
  },
  {
    path: '/:workspace',
    children: [
      {
        name: 'workspace',
        path: '',
        redirect: ({ params }) => defaultList(params.workspace),
      },
      {
        name: 'worklist',
        path: 'worklist/:worklistId',
        meta: { area: 'patients', isList: true },
      },
      {
        name: 'schedule',
        path: 'schedule',
        meta: { area: 'patients', isList: true },
      },
      // Every patient route starts the same PatientApp, which dispatches the page
      // while its patient shell remains attached. The dashboard/archive aliases
      // are bookmark compatibility only.
      {
        name: 'patient:workflow',
        path: 'patient/:patientId/workflow',
        aliases: [{ path: '/:workspace/patient/dashboard/:patientId', until: LEGACY_ALIAS_UNTIL }],
        meta: { area: 'patients' },
      },
      {
        name: 'patient:workflow:closed',
        path: 'patient/:patientId/workflow/closed',
        aliases: [{ path: '/:workspace/patient/archive/:patientId', until: LEGACY_ALIAS_UNTIL }],
        meta: { area: 'patients' },
      },
      {
        name: 'patient:interactions',
        path: 'patient/:patientId/interactions',
        meta: { area: 'patients' },
      },
      {
        name: 'patient:interaction',
        path: 'patient/:patientId/interactions/:interactionId',
        meta: { area: 'patients' },
      },
      {
        name: 'patient:action',
        path: 'patient/:patientId/action/:actionId',
        aliases: [{ path: '/:workspace/patient/archive/:patientId/action/:actionId', until: LEGACY_ALIAS_UNTIL }],
        meta: { area: 'patients' },
      },
      {
        name: 'patient:flow',
        path: 'patient/:patientId/flow/:flowId',
        meta: { area: 'patients' },
      },
      {
        name: 'patient:flow:focus',
        path: 'patient/:patientId/flow/:flowId/focus/:actionId',
        meta: { area: 'patients' },
      },
      {
        name: 'patient:flow:action',
        path: 'patient/:patientId/flow/:flowId/action/:actionId',
        meta: { area: 'patients' },
      },
      {
        name: 'patient:form',
        path: 'patient/:patientId/form/:formId',
        meta: { area: 'patients' },
      },
      {
        name: 'legacy:patient:flow',
        path: 'flow/:flowId',
        aliases: [{ path: '/:workspace/flow/:flowId/details' }],
        redirect: redirectFlow('patient:flow'),
      },
      {
        name: 'legacy:patient:flow:action',
        path: 'flow/:flowId/action/:actionId',
        redirect: redirectFlow('patient:flow:action'),
      },
      {
        name: 'programs:all',
        path: 'programs',
        meta: { area: 'programs', isList: true },
      },
      {
        name: 'program:details',
        path: 'program/:programId',
        meta: { area: 'programs' },
      },
      {
        name: 'program:action',
        path: 'program/:programId/action/:actionId',
        meta: { area: 'programs' },
      },
      {
        name: 'program:action:new',
        path: 'program/:programId/action',
        meta: { area: 'programs' },
      },
      {
        name: 'programFlow:new',
        path: 'program/:programId/flow',
        meta: { area: 'programs' },
      },
      {
        name: 'programFlow',
        path: 'program-flow/:flowId',
        meta: { area: 'programs' },
      },
      {
        name: 'programFlow:action',
        path: 'program-flow/:flowId/action/:actionId',
        meta: { area: 'programs' },
      },
      {
        name: 'programFlow:action:new',
        path: 'program-flow/:flowId/action',
        meta: { area: 'programs' },
      },
      {
        name: 'dashboards:all',
        path: 'dashboards',
        meta: { area: 'dashboards', isList: true },
      },
      {
        name: 'dashboard',
        path: 'dashboards/:dashboardId',
        meta: { area: 'dashboards' },
      },
      {
        name: 'clinicians:all',
        path: 'clinicians',
        meta: { area: 'clinicians', isList: true },
      },
      {
        name: 'clinician',
        path: 'clinicians/:clinicianId',
        meta: { area: 'clinicians' },
      },
    ],
  },
];
