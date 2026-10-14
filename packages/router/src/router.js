import { Events } from '@mnjs/utils';

/**
 * @typedef {object} Match
 * @property {string} name
 * @property {Record<string, string>} params
 * @property {URLSearchParams} query
 * @property {URL} url
 * @property {object} meta
 * @property {import('./matcher.js').BranchEntry[]} branch
 * @property {string | null} alias
 * @property {'push' | 'replace' | 'traverse' | 'reload'} navigationType
 * @property {boolean} initial True for the start() dispatch.
 * @property {any} info Per-navigation transient data.
 * @property {any} state Persisted entry state.
 * @property {string} key History entry key.
 * @property {AbortSignal} signal
 * @property {boolean} userInitiated
 *
 * @typedef {object} NavigateOptions
 * @property {'auto' | 'push' | 'replace'} [history]
 * @property {URLSearchParams | Record<string, string> | string} [query]
 * @property {any} [info]
 * @property {any} [state]
 *
 * @typedef {object} RouterOptions
 * @property {import('./matcher.js').RouteDefinition[]} routes
 * @property {import('./drivers/navigation.js').Driver} [driver] Defaults to navigationDriver().
 * @property {(url: URL) => boolean} [intercept] URLs the router may own; default all same-origin.
 * @property {{ name: string, within: (url: URL) => boolean }} [notFound]
 * @property {string[]} [persistParams]
 * @property {(match: Match, context: { signal: AbortSignal }) => any} [handler]
 * @property {number} [maxRedirects] Default 5.
 */

/**
 * Events (via `listenTo`): 'route' (match), 'route:ready' (match),
 * 'route:error' (error, match). See DESIGN.md "Router API".
 */
export class Router {
  /** @param {RouterOptions} options */
  constructor(options) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<boolean>} false when superseded or stopped. */
  start() {
    throw new Error('Not implemented');
  }

  stop() {
    throw new Error('Not implemented');
  }

  /**
   * `navigate(url, options)` when the first argument starts with '/' or has a
   * scheme; otherwise `navigate(name, params, options)`. Both promises resolve
   * false when superseded or aborted and never reject with AbortError.
   * @param {string} nameOrUrl
   * @param {Record<string, string | number> | NavigateOptions} [params]
   * @param {NavigateOptions} [options]
   * @returns {{ committed: Promise<boolean>, finished: Promise<boolean> }}
   */
  navigate(nameOrUrl, params, options) {
    throw new Error('Not implemented');
  }

  /**
   * @param {string} name
   * @param {Record<string, string | number>} [params] Missing persistParams are copied from the current match.
   * @param {{ query?: URLSearchParams | Record<string, string> | string }} [options]
   * @returns {string}
   */
  url(name, params, options) {
    throw new Error('Not implemented');
  }

  /**
   * @param {URL | string} url
   * @returns {Match | null}
   */
  match(url) {
    throw new Error('Not implemented');
  }

  /** @returns {Match | null} */
  getCurrent() {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<boolean>} */
  refresh() {
    throw new Error('Not implemented');
  }

  /**
   * @param {import('./matcher.js').RouteDefinition[]} routes
   * @param {{ parent?: string }} [options]
   * @returns {() => void}
   */
  mount(routes, options) {
    throw new Error('Not implemented');
  }

  getAliases() {
    throw new Error('Not implemented');
  }

  /** @param {string} name */
  getParamNames(name) {
    throw new Error('Not implemented');
  }

  /** @returns {boolean} */
  get canGoBack() {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<boolean>} false when there is no router-owned entry. */
  back() {
    throw new Error('Not implemented');
  }

  /** @param {any} state Merged into the current entry's persisted state. */
  updateState(state) {
    throw new Error('Not implemented');
  }
}

Object.assign(Router.prototype, Events);
