import { openDB } from 'idb';

const DB_NAME = 'careops-cache';
// IndexedDB database version — bump only for object-store schema changes.
const DB_VERSION = 2;
const STORES = ['entities', 'formDrafts'];
// A blocked version upgrade (e.g. another tab holding an older version open)
// leaves the open pending forever. Cap the wait so a cache open can never gate
// startup — callers fall back to running without the cache.
const OPEN_TIMEOUT_MS = 3000;

let dbPromise;

function openDatabase() {
  let db;

  return openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      STORES.forEach(name => {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name);
      });
    },
    blocking() {
      // A newer version is trying to open in another tab and we are blocking
      // it. Close so that upgrade proceeds instead of deadlocking both tabs,
      // and drop the memo so the next caller opens afresh.
      dbPromise = undefined;
      if (db) db.close();
    },
    terminated() {
      dbPromise = undefined;
    },
  }).then(opened => {
    db = opened;
    return opened;
  });
}

function getDb() {
  if (dbPromise) return dbPromise;

  let opening;
  try {
    opening = openDatabase();
  } catch {
    // Synchronous open failure (IndexedDB unavailable): memoize no-cache so
    // later callers fail fast like the timeout/async-failure cases.
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }

  // A blocked upgrade (another tab holding an older version open) leaves the
  // open pending forever. Bound the wait once, inside the memoized promise, so
  // a blocked or failed open resolves to null and every later caller fails fast
  // instead of paying the timeout again. blocking()/terminated() or __reset()
  // clear the memo to allow a fresh open.
  let timedOut = false;
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, OPEN_TIMEOUT_MS);
  });

  // If the open only finishes after we have already given up, close the
  // orphaned connection so it cannot linger or block a later upgrade.
  opening.then(db => {
    if (timedOut && db) db.close();
  }).catch(() => {});

  dbPromise = Promise.race([opening, timeout])
    .catch(() => null)
    .then(db => {
      clearTimeout(timer);
      return db;
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
