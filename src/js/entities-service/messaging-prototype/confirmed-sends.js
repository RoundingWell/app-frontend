import { attemptScope, attemptedSend } from './send-attempts';

const records = new Map();
const acknowledged = new Set();

export function rememberConfirmation(patientId, model) {
  const scope = attemptScope(patientId);
  const key = `${ scope }:${ model.id }`;
  if (!acknowledged.has(key)) records.set(key, { scope, model });
}

export function pendingConfirmations(patientId) {
  const scope = attemptScope(patientId);
  return [...records.values()].filter(entry => entry.scope === scope).map(entry => entry.model);
}

export function acknowledgeConfirmations(patientId, models) {
  const scope = attemptScope(patientId);
  const pendingId = attemptedSend(patientId)?.id;
  // Release consumed models, retaining only own-write IDs for duplicate and
  // read-before-POST-response suppression.
  models.forEach(model => {
    const key = `${ scope }:${ model.id }`;
    if (records.delete(key) || model.id === pendingId) acknowledged.add(key);
  });
}
