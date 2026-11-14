import { comparePositions, position } from './history';

// Refresh from the actual newest server edge through the previous lower anchor
// and every confirmed send. At/on neighborhoods are not missing-gap fills.
export async function refreshLatestWindow(window, required, readPage, { signal, limit = 25 }) {
  const models = [];
  const positions = new Map();
  const wanted = new Set(required.map(model => model.id));
  if (window.models.length) wanted.add(window.models[0].id);
  let before;
  while (true) {
    const page = await readPage({ before, limit });
    signal.throwIfAborted();
    appendPage(models, page, positions);
    page.forEach(model => wanted.delete(model.id));
    const exhausted = page.length < limit;
    if (exhausted || (!wanted.size && window.hasOlder)) {
      if (wanted.size) throw new Error('The confirmed text or loaded anchor was not covered by this refresh.');
      return verifyWindow({ models: models.reverse(), hasOlder: !exhausted, hasNewer: false }, positions);
    }
    before = page.at(-1).id;
  }
}

function appendPage(models, page, positions) {
  let previous = models.length ? positions.get(models.at(-1).id) : null;
  for (const model of page) {
    const next = position(model);
    if (positions.has(model.id) || (previous && comparePositions(previous, next) <= 0)) throw new Error('The interaction cursor did not make ordered progress.');
    positions.set(model.id, next);
    models.push(model);
    previous = next;
  }
}

export function verifyWindow(window, positions) {
  for (const model of window.models) {
    if (comparePositions(positions.get(model.id), position(model))) throw new Error('An interaction moved during the confirmed-send refresh.');
  }
  return window;
}

// Extend a covered interval through confirmed records, retaining both old cursor
// edges. An around-ID read is never used as a substitute for the intervening gap.
export async function extendConnectedWindow(window, required, readPage, { signal, limit = 25, maxPages = 30 }) {
  if (!window.models.length) return refreshLatestWindow(window, required, budgetedRead(readPage, maxPages), { signal, limit });
  const models = [...window.models];
  const requiredPositions = new Map(required.map(model => [model.id, position(model)]));
  const positions = new Map(models.map(model => [model.id, position(model)]));
  verifyOrder(models);
  const read = budgetedRead(readPage, maxPages);
  const hasOlder = await extendEdge(models, positions, required, false, window.hasOlder, read, signal, limit);
  const hasNewer = await extendEdge(models, positions, required, true, window.hasNewer, read, signal, limit);
  // Matching rows inside the proven interval can be inserted without replacing
  // either edge with a disconnected cursor.
  for (const model of required) {
    if (positions.has(model.id)) continue;
    positions.set(model.id, position(model));
    models.push(model);
  }
  models.sort((left, right) => comparePositions(position(left), position(right)));
  verifyOrder(models);
  verifyWindow({ models: required }, requiredPositions);
  return verifyWindow({ models, hasOlder, hasNewer }, positions);
}

async function extendEdge(models, positions, required, newer, hasMore, read, signal, limit) {
  let cursor = windowEdge(models, newer);
  const outside = outsideEdge(required, positions.get(cursor.id), newer);
  if (!outside.length) return hasMore;
  const wanted = new Set(outside.map(model => model.id));
  let exhausted = false;
  // An exhausted edge must be re-proven. A middle window retains its unknown
  // outer interval once connected pages cover the required row.
  while (wanted.size || (!hasMore && !exhausted)) {
    const page = await read({ [newer ? 'after' : 'before']: cursor.id, limit });
    signal.throwIfAborted();
    appendEdge(models, positions, page, cursor, newer);
    page.forEach(model => wanted.delete(model.id));
    exhausted = page.length < limit;
    if (exhausted) {
      if (wanted.size) throw new Error('The new interaction was not covered by the connected refresh.');
      break;
    }
    cursor = page.at(-1);
  }
  return !exhausted;
}

function windowEdge(models, newer) {
  return newer ? models.at(-1) : models[0];
}

function outsideEdge(required, edge, newer) {
  return required.filter(model => (newer ? 1 : -1) * comparePositions(position(model), edge) > 0);
}

function appendEdge(models, positions, page, cursor, newer) {
  let previous = positions.get(cursor.id);
  for (const model of page) {
    const next = position(model);
    if (positions.has(model.id) || (newer ? 1 : -1) * comparePositions(previous, next) >= 0) throw new Error('The interaction cursor did not make ordered progress.');
    positions.set(model.id, next);
    previous = next;
  }
  if (newer) models.push(...page);
  else models.unshift(...[...page].reverse());
}

function budgetedRead(readPage, maxPages) {
  let pages = 0;
  return query => {
    if (++pages > maxPages) throw new Error('The connected refresh exceeded its scan budget. History is incomplete.');
    return readPage(query);
  };
}

function verifyOrder(models) {
  for (let index = 1; index < models.length; index++) {
    if (comparePositions(position(models[index - 1]), position(models[index])) >= 0) throw new Error('The loaded interaction interval is no longer ordered.');
  }
}
