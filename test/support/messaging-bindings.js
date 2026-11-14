// Local interception identities only. These are not persisted sandbox records.
export default {
  hostname: 'messaging-demo.invalid',
  stage: 'dev',
  organization: 'demo',
  namespace: 'messaging-demo/contract/v1',
  legacyNamespace: 'messaging-demo/legacy/v1',
  workspaceId: '10000000-0000-4000-8000-000000000001',
  writablePatientId: '20000000-0000-4000-8000-000000000001',
  patientIds: [1, 2, 3, 4, 5, 6].map(id => `20000000-0000-4000-8000-${ String(id).padStart(12, '0') }`),
};
