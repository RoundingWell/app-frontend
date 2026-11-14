import { find } from 'underscore';

import message from './intl';

export function getAvailability(state, numberId) {
  if (state.get('enabled') !== true || state.get('canCompose') !== true || state.get('scheduled') === true) {
    return state.get('disabledReason') || message('unavailable');
  }
  return getNumberAvailability(state, numberId);
}

function getNumberAvailability(state, numberId) {
  const number = find(state.get('numbers'), { id: numberId });
  if (!number) return numberId ? message('removed') : message('chooseNumber');
  return number.available === true ? '' : number.reason || message('unavailable');
}

function canSubmit(adapter, session) {
  const { body, numberId, pending } = session.attributes;
  return !pending && !!body.trim() && !getAvailability(adapter.state, numberId);
}

// No View is retained by the request. Hosts reconcile their own confirmed POST,
// including a response received after navigation (own websocket echoes are absent).
export async function submitDraft(adapter, session, context) {
  const { body, numberId, revision } = session.attributes;
  if (!canSubmit(adapter, session)) return false;
  const submission = { ...context, numberId, body };
  session.set({ pending: true, error: '', status: '' });
  let confirmation;
  try {
    await adapter.refreshEligibility(submission);
    const reason = getAvailability(adapter.state, numberId);
    if (reason) {
      session.set({ pending: false, error: reason });
      return false;
    }
    confirmation = await adapter.submit(submission);
    if (!confirmation) throw new Error('A confirmed submission is required.');
  } catch(error) {
    session.set({ pending: false, error: message(error.outcome === 'uncertain' ? 'unconfirmed' : 'failed') });
    return false;
  }
  if (session.get('revision') === revision) session.set('body', '');
  session.set({ pending: false, status: message('sent') });
  try {
    await adapter.reconcile(confirmation, submission);
  } catch {
    session.set('status', message('refreshFailed'));
  }
  session.trigger('confirmed', confirmation);
  return true;
}
