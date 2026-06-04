import { openDB } from 'idb';

const DB_NAME = 'careops-cache';
// IndexedDB database version — bump only for object-store schema changes.
const DB_VERSION = 2;
const STORES = ['entities', 'formDrafts'];

let dbPromise;

function getDb() {
  if (dbPromise) return dbPromise;

  try {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        });
      },
    }).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }

  // Don't memoize a failed open; clear so the next caller retries.
  dbPromise.then(db => {
    if (!db) dbPromise = undefined;
  });

  return dbPromise;
}

async function get(store, key) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    return await db.get(store, key);
  } catch {
    return undefined;
  }
}

async function put(store, key, value) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.put(store, value, key);
  } catch {
    // Fail soft, including QuotaExceededError — a cache write must never break startup.
  }
}

async function del(store, key) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(store, key);
  } catch {
    // fail soft
  }
}

async function clear(store) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.clear(store);
  } catch {
    // fail soft
  }
}

async function keys(store) {
  try {
    const db = await getDb();
    if (!db) return [];
    return await db.getAllKeys(store);
  } catch {
    return [];
  }
}

// Test hook: drops the cached connection so a fresh getDb() re-evaluates availability.
function __reset() {
  dbPromise = undefined;
}

export default { get, put, delete: del, clear, keys, __reset };
