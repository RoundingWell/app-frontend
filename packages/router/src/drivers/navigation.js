/**
 * Driver contract (shared by every driver; DESIGN.md "Driver contract"):
 *
 * - `entry.url` and `event.destination.url` are absolute URL strings, as in the
 *   native Navigation API. `getState()` returns a structured clone.
 * - `navigate()` returns native promises. A navigation superseded or aborted
 *   rejects with an error named 'AbortError'; the Router absorbs those.
 * - `navigate` listener events expose the subset of NavigateEvent listed in
 *   DESIGN.md and honor `intercept({ handler, focusReset, scroll })`.
 *
 * @typedef {object} DriverEntry
 * @property {string} url
 * @property {string} key
 * @property {number} index
 * @property {() => any} getState
 *
 * @typedef {object} Driver
 * @property {{ cancelTraverse: boolean, interceptsLinks: boolean }} capabilities
 * @property {DriverEntry} currentEntry
 * @property {() => DriverEntry[]} entries
 * @property {(url: string, options?: { history?: 'auto' | 'push' | 'replace', state?: any, info?: any }) => { committed: Promise<DriverEntry>, finished: Promise<DriverEntry> }} navigate
 * @property {(options?: { info?: any, state?: any }) => { committed: Promise<DriverEntry>, finished: Promise<DriverEntry> }} reload
 * @property {() => { committed: Promise<DriverEntry>, finished: Promise<DriverEntry> }} back
 * @property {(key: string) => { committed: Promise<DriverEntry>, finished: Promise<DriverEntry> }} traverseTo
 * @property {(options: { state: any }) => void} updateCurrentEntry
 * @property {(type: 'navigate', listener: (event: object) => void, options?: { signal?: AbortSignal }) => void} addEventListener
 */

/**
 * Adapts `window.navigation` to the Driver contract.
 * @param {object} [navigation] Defaults to `window.navigation`.
 * @returns {Driver}
 */
export function navigationDriver(navigation) {
  throw new Error('Not implemented');
}
