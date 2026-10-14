/**
 * In-memory Driver for tests (contract: see ./navigation.js). Events fire in the
 * same order as the native API with deterministic timing, including supersession
 * (a new navigation aborts the previous event's signal) and traversal.
 *
 * Test-only extensions on the returned object:
 * - `simulate(url, { navigationType, userInitiated, canIntercept, hashChange,
 *   downloadRequest, formData, info })` dispatches a navigate event as a link
 *   click, `history.pushState`, or form submission would, and returns
 *   `{ committed, finished }`. `navigationType` defaults to 'push';
 *   `userInitiated` and `canIntercept` default to true.
 * - `documentNavigations`: URLs of navigations that no listener intercepted (a
 *   real browser would load a new document). They still commit the entry.
 *
 * @param {{ url?: string }} [options] Initial URL, default 'http://localhost/'.
 * @returns {import('./navigation.js').Driver & {
 *   simulate: Function, documentNavigations: string[]
 * }}
 */
export function memoryDriver(options) {
  throw new Error('Not implemented');
}
