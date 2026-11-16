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

function canSubmit(state, session) {
  const { body, numberId, pending, uncertain } = session.attributes;
  return !pending && !uncertain && !!body.trim() && !getAvailability(state, numberId);
}

function submissionFailure(error) {
  const uncertain = error?.outcome !== 'rejected';
  return { pending: false, uncertain, error: message(uncertain ? 'unconfirmed' : 'failed') };
}

// No View is retained by the request. Hosts reconcile their own confirmed POST,
// including a response received after navigation (own websocket echoes are absent).
export async function submitDraft(session, { state, context, refreshEligibility, submit, reconcile }) {
  const { body, numberId, revision } = session.attributes;
  if (!canSubmit(state, session)) return false;
  const submission = { ...context, numberId, body };
  session.set({ pending: true, error: '', status: '' });
  let confirmation;
  try {
    await refreshEligibility(submission);
    const reason = getAvailability(state, numberId);
    if (reason) {
      session.set({ pending: false, error: reason });
      return false;
    }
  } catch {
    session.set({ pending: false, error: message('failed') });
    return false;
  }
  try {
    confirmation = await submit(submission);
    if (!confirmation) throw new Error('A confirmed submission is required.');
  } catch(error) {
    session.set(submissionFailure(error));
    return false;
  }
  if (session.get('revision') === revision) session.set('body', '');
  session.set({ pending: false, uncertain: false, status: message('sent') });
  try {
    await reconcile(confirmation, submission);
  } catch {
    session.set('status', message('refreshFailed'));
  }
  session.trigger('confirmed', confirmation);
  return true;
}
