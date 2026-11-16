import { comparePositions, position } from './interaction-order';

export function isActionHistoryMessage(model, actionId, now = Date.now()) {
  if (model.getChannelGroup() !== 'messages') return false;
  const upcoming = !model.get('occurred_at') && !model.get('cancelled_at') && Date.parse(model.get('expected_at')) > now;
  return !upcoming || model.get('_action')?.id === actionId;
}

function appendPage(state, rows, actionId) {
  for (const model of rows) {
    const next = position(model);
    verifyProgress(state, model, next);
    state.seen.set(model.id, next);
    state.previous = next;
    state.raw.push(model);
    state.required.delete(model.id);
    if (isActionHistoryMessage(model, actionId)) state.visible++;
  }
}

function verifyProgress(state, model, next) {
  if (!Number.isFinite(next.time) || state.seen.has(model.id)) throw new Error('The interaction cursor repeated or has no ordering timestamp.');
  if (state.previous && comparePositions(state.previous, next) <= 0) throw new Error('The interaction cursor did not make ordered progress.');
}

function verifiedWindow(state, before, hasOlder) {
  for (const model of state.raw) {
    if (comparePositions(state.seen.get(model.id), position(model))) throw new Error('An interaction moved while messages were loading. Reload messages.');
  }
  return { models: state.raw.reverse(), before, hasOlder };
}

function nextCursor(before, cursor, hasOlder) {
  if (hasOlder && (!cursor || cursor === before)) throw new Error('The message cursor did not advance.');
  return cursor || before;
}

function completeWindow(state, hasOlder, limit, deletedIds) {
  for (const id of deletedIds) state.required.delete(id);
  if (!hasOlder && state.required.size) throw new Error('Loaded interactions are missing from the refreshed history. Reload messages.');
  return !hasOlder || (state.visible >= limit && !state.required.size);
}

// The cursor always follows the last raw server row, including hidden future
// texts. A hidden-only page never means the patient's history is exhausted.
export async function readMessageWindow(readPage, { signal, actionId, before, requiredIds = [], deletedIds, limit = 10 }) {
  // A refresh must be able to cover the window the user already loaded. The
  // extra budget bounds intervening arrivals and hidden future pages.
  const maxPages = Math.ceil(requiredIds.length / limit) + 30;
  const state = { required: new Set(requiredIds), seen: new Map(), raw: [], visible: 0 };
  for (let page = 0; page < maxPages; page++) {
    const { models, rawCount, cursor } = await readPage({ before, limit });
    signal.throwIfAborted();
    appendPage(state, models, actionId);
    const hasOlder = rawCount === limit;
    before = nextCursor(before, cursor, hasOlder);
    if (completeWindow(state, hasOlder, limit, deletedIds)) return verifiedWindow(state, before, hasOlder);
  }
  throw new Error('Message loading exceeded its request budget. History is incomplete.');
}
