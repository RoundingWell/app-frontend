// Per-fetch JSON:API response cache. On hit, cached docs replay through
// Backbone's parse pipeline so state is byte-identical to a fresh fetch.
// SWR orchestration lives in BaseEntity.fetch*Cache.

import dayjs from 'dayjs';

import idb from './idb';

export const ENTRY_VERSION = 1;
// SWR refreshes on every online load, so TTL only bounds offline / cold-start staleness.
const TTL_HOURS = 24 * 7;
const STORE = 'entities';
const KEY_SEPARATOR = '|';

// Single source of truth for the cache key format.
export function cacheKey(userId, workspaceId, url) {
  return `${ userId }${ KEY_SEPARATOR }${ workspaceId || '' }${ KEY_SEPARATOR }${ url }`;
}

export async function getResponse(key) {
  if (!key) return null;
  const entry = await idb.get(STORE, key);
  if (!entry) return null;
  if (entry.entryVersion !== ENTRY_VERSION || dayjs.utc().diff(dayjs.utc(entry.ts), 'hour') >= TTL_HOURS) {
    idb.delete(STORE, key); // opportunistic cleanup of unusable entries
    return null;
  }
  return entry.response;
}

export async function setResponse(key, response) {
  if (!key || !response) return;
  // Synchronous deep-snapshot: later mutations to `response` (e.g. by
  // Backbone's parse pipeline) cannot leak into the cached form.
  const snapshot = JSON.parse(JSON.stringify(response));
  await idb.put(STORE, key, {
    entryVersion: ENTRY_VERSION,
    ts: dayjs.utc().format(),
    response: snapshot,
  });
}

// Wipe every cached response. Used on explicit logout.
export async function clearCache() {
  await idb.clear(STORE);
}

// On successful auth, drop any responses keyed for a different user.
export async function pruneOtherPartitions(currentUserId) {
  if (!currentUserId) return;
  const prefix = `${ currentUserId }${ KEY_SEPARATOR }`;
  const keys = await idb.keys(STORE);
  await Promise.all(
    keys
      .filter(k => typeof k === 'string' && !k.startsWith(prefix))
      .map(k => idb.delete(STORE, k)),
  );
}
