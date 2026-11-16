import Backbone from 'backbone';

import sessionStore from 'js/utils/session-store';

function validateContext({ sessionScope, patientId, actionId }) {
  const hasActionContext = actionId === null || (typeof actionId === 'string' && actionId);
  if (!sessionScope || !patientId || !hasActionContext) {
    throw new TypeError('Composer requires sessionScope, patientId and an explicit actionId (null for Interactions).');
  }
}

// The host retains this model across View replacement, including pending requests.
export function createComposerDraft({ sessionScope, patientId, actionId, initialNumberId = '', initialNumberLabel = '' }) {
  validateContext({ sessionScope, patientId, actionId });
  const key = `messaging-composer:${ JSON.stringify([sessionScope, patientId, actionId]) }`;
  const draft = sessionStore.get(key) || { body: '', numberId: initialNumberId, numberLabel: initialNumberLabel };
  const session = new Backbone.Model({ ...draft, revision: 0, pending: false, uncertain: false, error: '', status: '' });
  session.on('change:body change:numberId change:numberLabel', () => {
    try {
      sessionStore.set(key, {
        body: session.get('body'),
        numberId: session.get('numberId'),
        numberLabel: session.get('numberLabel'),
      });
    } catch { /* Keep the in-memory draft if session storage is full. */ }
  });
  return session;
}

export function updateDraft(session, attributes) {
  session.set({ ...attributes, revision: session.get('revision') + 1, error: '', status: '' });
}
