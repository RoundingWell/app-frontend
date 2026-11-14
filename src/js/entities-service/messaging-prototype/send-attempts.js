import { Radio } from 'marionette';

import sessionStore from 'js/utils/session-store';

export function attemptScope(patientId) {
  const userId = Radio.request('bootstrap', 'currentUser')?.id;
  const workspaceId = Radio.request('workspace', 'current')?.id;
  if (!userId || !workspaceId) throw new Error('The Messaging session is unavailable.');
  return `prototype-send:${ JSON.stringify([workspaceId, userId, patientId]) }`;
}

export function attemptedSend(patientId) {
  return sessionStore.get(attemptScope(patientId));
}

export function retainAttempt(scope, id) {
  sessionStore.set(scope, { id });
  if (sessionStore.get(scope)?.id !== id) throw new Error('Unable to preserve the recording request. Nothing was submitted.');
}

export function clearAttempt(scope) {
  sessionStore.remove(scope);
}
