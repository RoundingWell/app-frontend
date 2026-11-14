// The deployed dev API sorts cancelled rows at expected_at. A bounded complete
// read is needed for this finite fixture to display them at cancellation time.
// This is not network-on-scroll pagination or a production snapshot contract.
import { get } from 'underscore';

export function position(model, display = false) {
  const stamp = (display && model.get('cancelled_at')) || model.getTimestamp();
  const time = stamp ? Date.parse(stamp) : Infinity;
  if (Number.isNaN(time)) throw new Error('Invalid interaction timestamp.');
  const fraction = get(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/.exec(stamp || ''), 1, '');
  return { id: model.id.toLowerCase(), time, remainder: fraction.padEnd(9, '0').slice(3) };
}

export function comparePositions(left, right) {
  if (left.time !== right.time) return left.time < right.time ? -1 : 1;
  if (left.remainder !== right.remainder) return left.remainder < right.remainder ? -1 : 1;
  return left.id === right.id ? 0 : left.id < right.id ? -1 : 1;
}

export async function readSnapshot(readPage, { signal, pageLimit = 10, maxPages = 30 }) {
  const models = [];
  const seen = new Map();
  let before;
  for (let page = 0; page < maxPages; page++) {
    const rows = await readPage({ before, limit: pageLimit });
    signal.throwIfAborted();
    for (const model of rows) {
      if (seen.has(model.id)) throw new Error('The interaction cursor repeated. Reload history.');
      seen.set(model.id, position(model));
      models.push(model);
    }
    if (rows.length < pageLimit) return verifySnapshot(models, seen);
    before = rows.at(-1).id;
  }
  throw new Error('The synthetic history exceeded its reviewed scan budget. History is incomplete.');
}

function verifySnapshot(models, seen) {
  for (const model of models) {
    if (comparePositions(seen.get(model.id), position(model))) throw new Error('Interaction order changed during loading. Reload history.');
  }
  return models;
}

export function visibleHistory(models, present, actionId, now = Date.now()) {
  return models.filter(model => {
    const row = present(model);
    if (!historyItem(model, row)) return false;
    if (get(row, 'kind') === 'consent_audit') return true;
    const linkedAction = get(row, 'actionId', get(model.attributes, ['_action', 'id']));
    return !futureMessage(model, now) || linkedAction === actionId;
  }).sort((left, right) => comparePositions(position(left, true), position(right, true)));
}

function historyItem(model, row) {
  if (!model.getTimestamp() && !model.get('cancelled_at')) return false;
  if (!row) return model.get('channel') === 'sms';
  return row.kind !== 'hidden';
}

function futureMessage(model, now) {
  return !model.get('occurred_at') && !model.get('cancelled_at') && Date.parse(model.get('expected_at')) > now;
}
