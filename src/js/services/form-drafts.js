import idb from 'js/base/cache/idb';

const STORE = 'formDrafts';
const KEY_PREFIX = 'form-subm-';

export function draftKeyPrefix(currentUserId) {
  if (!currentUserId) return;
  return `${ KEY_PREFIX }${ currentUserId }-`;
}

export async function getDraft(key) {
  if (!key) return null;
  const draft = await idb.get(STORE, key);
  return draft || null;
}

export async function setDraft(key, draft) {
  if (!key || !draft) return;
  await idb.put(STORE, key, draft);
}

export async function removeDraft(key) {
  if (!key) return;
  await idb.delete(STORE, key);
}

export async function clearDrafts() {
  await idb.clear(STORE);
}

export async function pruneOtherDrafts(currentUserId) {
  const prefix = draftKeyPrefix(currentUserId);
  if (!prefix) return;

  const keys = await idb.keys(STORE);
  await Promise.all(
    keys
      .filter(key => typeof key === 'string' && !key.startsWith(prefix))
      .map(key => removeDraft(key)),
  );
}
