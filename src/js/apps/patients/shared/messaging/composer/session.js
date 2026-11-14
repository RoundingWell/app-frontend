import Backbone from 'backbone';

import sessionStore from 'js/utils/session-store';

const sessions = new Map();

function validateContext({ sessionScope, patientId, actionId }) {
  const hasActionContext = actionId === null || (typeof actionId === 'string' && actionId);
  if (!sessionScope || !patientId || !hasActionContext) {
    throw new TypeError('Composer requires sessionScope, patientId and an explicit actionId (null for Interactions).');
  }
}

// A request belongs to the session, so replacing its View cannot unlock Send.
export function getComposerSession({ sessionScope, patientId, actionId, initialNumberId = '' }) {
  validateContext({ sessionScope, patientId, actionId });
  const key = `messaging-composer:${ JSON.stringify([sessionScope, patientId, actionId]) }`;
  if (sessions.has(key)) return sessions.get(key);
  const draft = sessionStore.get(key) || { body: '', numberId: initialNumberId, numberLabel: '' };
  const session = new Backbone.Model({ ...draft, revision: 0, pending: false, error: '', status: '' });
  session.on('change:body change:numberId change:numberLabel', () => {
    try {
      sessionStore.set(key, {
        body: session.get('body'),
        numberId: session.get('numberId'),
        numberLabel: session.get('numberLabel'),
      });
    } catch { /* Keep the in-memory draft if session storage is full. */ }
  });
  sessions.set(key, session);
  return session;
}

export function updateDraft(session, attributes) {
  session.set({ ...attributes, revision: session.get('revision') + 1, error: '', status: '' });
}
