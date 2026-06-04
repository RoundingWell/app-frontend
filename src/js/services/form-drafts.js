import idb from 'js/base/cache/idb';

const STORE = 'formDrafts';
const KEY_PREFIX = 'form-subm-';

export function draftKeyPrefix(currentUserId) {
  if (!currentUserId) return;
  return `${ KEY_PREFIX }${ currentUserId }-`;
}

export async function getDraft(key) {
  try {
    if (!key) return null;
    const draft = await idb.get(STORE, key);
    return draft || null;
  } catch {
    return null;
  }
}

export async function setDraft(key, draft) {
  try {
    if (!key || !draft) return;
    await idb.put(STORE, key, draft);
  } catch {
    // Draft writes must never interrupt form editing.
  }
}

export async function removeDraft(key) {
  try {
    if (!key) return;
    await idb.delete(STORE, key);
  } catch {
    // fail soft
  }
}

export async function clearDrafts() {
  try {
    await idb.clear(STORE);
  } catch {
    // fail soft
  }
}

export async function pruneOtherDrafts(currentUserId) {
  try {
    const prefix = draftKeyPrefix(currentUserId);
    if (!prefix) return;

    const keys = await idb.keys(STORE);
    await Promise.all(
      keys
        .filter(key => typeof key === 'string' && !key.startsWith(prefix))
        .map(key => removeDraft(key)),
    );
  } catch {
    // fail soft
  }
}
