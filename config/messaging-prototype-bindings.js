import { readFileSync } from 'node:fs';

// Runtime targets and fixture identities belong to an explicit private build input.
// Ordinary builds have no enabled Messaging prototype patients.
function isDevelopmentTarget(value) {
  const hostname = /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i;
  return hostname.test(value.hostname) && value.stage === 'dev'
    && [value.organization, value.namespace, value.legacyNamespace].every(item => typeof item === 'string' && !!item.trim());
}

export function loadMessagingBindings(filename) {
  if (!filename) return { hostname: null, stage: null, organization: null, namespace: null, legacyNamespace: null, workspaceId: null, writablePatientId: null, patientIds: [] };
  const value = JSON.parse(readFileSync(filename, 'utf8'));
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (!isDevelopmentTarget(value) || !uuid.test(value.workspaceId) || !Array.isArray(value.patientIds)
    || !value.patientIds.length || !value.patientIds.every(id => typeof id === 'string' && uuid.test(id))
    || !value.patientIds.includes(value.writablePatientId)) {
    throw new Error('Messaging prototype bindings require an explicit development target, namespaces and patient/write allowlist.');
  }
  const { organization, namespace, legacyNamespace, workspaceId, writablePatientId, patientIds } = value;
  return { hostname: value.hostname, stage: value.stage, organization, namespace, legacyNamespace, workspaceId, writablePatientId, patientIds };
}
