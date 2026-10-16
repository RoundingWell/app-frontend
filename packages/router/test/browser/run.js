import { navigationDriver } from '@mnjs/router';

import { driverConformance } from '../conformance/index.js';
import { routerConformance } from '../conformance/router.js';

// A minimal describe/it runner and the Chai-style assert subset the conformance
// suites rely on (ok, equal, notEqual, deepEqual on JSON-like values). Results
// are published on window.__conformance for the Playwright spec.
const TEST_TIMEOUT = 10000;
const tests = [];
const titles = [];

function describe(title, body) {
  titles.push(title);
  try {
    body();
  } finally {
    titles.pop();
  }
}

function it(title, fn) {
  tests.push({ title: [...titles, title].join(' > '), fn });
}

function fail(message, detail) {
  throw new Error(message ? `${ message }: ${ detail }` : detail);
}

const isObject = value => typeof value === 'object' && value !== null;

function isDeepEqual(actual, expected) {
  if (Object.is(actual, expected)) return true;
  if (!isObject(actual) || !isObject(expected)) return false;
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false;
  const keys = Object.keys(actual);
  if (keys.length !== Object.keys(expected).length) return false;
  return keys.every(key => Object.hasOwn(expected, key) && isDeepEqual(actual[key], expected[key]));
}

const show = value => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const assert = {
  ok(value, message) {
    if (!value) fail(message, `expected ${ show(value) } to be truthy`);
  },
  equal(actual, expected, message) {
    if (actual !== expected) fail(message, `expected ${ show(actual) } to equal ${ show(expected) }`);
  },
  notEqual(actual, expected, message) {
    if (actual === expected) fail(message, `expected ${ show(actual) } to not equal ${ show(expected) }`);
  },
  deepEqual(actual, expected, message) {
    if (!isDeepEqual(actual, expected)) fail(message, `expected ${ show(actual) } to deeply equal ${ show(expected) }`);
  },
};

// Navigations started before the load event has finished are converted to
// replace (the document is not yet completely loaded), so wait a task past it.
function documentLoaded() {
  const loaded = document.readyState === 'complete' ?
    Promise.resolve() :
    new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  return loaded.then(() => new Promise(resolve => setTimeout(resolve)));
}

async function createDriver() {
  await documentLoaded();
  return { driver: navigationDriver(window.navigation) };
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ TEST_TIMEOUT } ms`)), TEST_TIMEOUT);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function run() {
  await documentLoaded();
  const results = [];
  for (const { title, fn } of tests) {
    try {
      await withTimeout(Promise.resolve().then(fn));
      results.push({ title, ok: true });
    } catch(error) {
      results.push({ title, ok: false, error: `${ error?.name }: ${ error?.message }\n${ error?.stack ?? '' }` });
    }
  }
  return results;
}

window.__conformance = { done: false, supported: 'navigation' in window && 'URLPattern' in window };

if (window.__conformance.supported) {
  driverConformance({ name: 'navigationDriver', createDriver, describe, it, assert });
  routerConformance({ name: 'navigationDriver', createDriver, describe, it, assert });
}

run().then(results => {
  window.__conformance = { ...window.__conformance, done: true, results };
});
