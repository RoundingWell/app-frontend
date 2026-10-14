import { Events } from '@mnjs/utils';

import { Matcher } from './matcher.js';
import { navigationDriver } from './drivers/navigation.js';

const MARKER = '@mnjs/router';
const URL_FORM = /^(?:\/|[a-z][a-z\d+.-]*:\/\/)/i;
const noop = () => {};

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

const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);

const isThenable = value => typeof value?.then === 'function';

const isMarked = state => state?.[MARKER] === true;

const newChain = (initial = false) => ({ initial, hops: 0, followUp: null });

function rejection(error) {
  const promise = Promise.reject(error);
  promise.catch(noop);
  return promise;
}

function toSearchParams(query) {
  if (query === undefined || query === null) return new URLSearchParams();
  if (typeof query === 'string' || query instanceof URLSearchParams) return new URLSearchParams(query);
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);
  return new URLSearchParams(entries);
}

function assertState(state) {
  if (state !== undefined && state !== null && !isObject(state)) {
    throw new TypeError('Entry state must be a plain object');
  }
}

function withMarker(state) {
  assertState(state);
  return { ...state, [MARKER]: true };
}

function publicState(state) {
  if (!isObject(state)) return state ?? undefined;
  const copy = { ...state };
  delete copy[MARKER];
  return copy;
}

function outcome(promise) {
  return promise.then(() => true, error => {
    if (error?.name === 'AbortError') return false;
    throw error;
  });
}

function notFoundBase(name, url) {
  return { name, params: {}, query: new URLSearchParams(url.search), url, meta: {}, branch: [], alias: null };
}

function toMatch(base, nav, key, rawState) {
  return {
    name: base.name,
    params: base.params,
    query: base.query,
    url: base.url,
    meta: base.meta,
    branch: base.branch,
    alias: base.alias,
    navigationType: nav.navigationType,
    initial: nav.initial,
    info: nav.info,
    state: publicState(rawState),
    key,
    signal: nav.signal,
    userInitiated: nav.userInitiated,
  };
}

/**
 * Events (via `listenTo`): 'route' (match), 'route:ready' (match),
 * 'route:error' (error, match). See DESIGN.md "Router API".
 */
export class Router {
  #matcher;
  #options;
  #driverOption;
  #resolvedDriver = null;
  #session = null;
  #local = null;
  #chain = null;
  #current = null;

  /** @param {RouterOptions} options */
  constructor(options) {
    const { routes, driver, intercept = () => true, notFound, persistParams = [], handler, maxRedirects = 5 } = options;
    this.#matcher = new Matcher(routes);
    this.#driverOption = driver;
    this.#options = { intercept, notFound, persistParams, handler, maxRedirects };
  }

  get #driver() {
    this.#resolvedDriver ??= this.#driverOption ?? navigationDriver();
    return this.#resolvedDriver;
  }

  /**
   * Resolves true when the initial dispatch is ready and false when it was
   * superseded, stopped, or the URL is not the router's to handle. Rejects with
   * the handler failure, like `finished`.
   * @returns {Promise<boolean>}
   */
  start() {
    if (this.#session) return this.#session.initial;
    const driver = this.#driver;
    const session = { controller: new AbortController(), initial: null };
    this.#session = session;
    driver.addEventListener('navigate', event => this.#onNavigate(event), { signal: session.controller.signal });
    session.initial = this.#dispatchInitial(session);
    return session.initial;
  }

  stop() {
    this.#abortLocal();
    this.#session?.controller.abort();
    this.#session = null;
  }

  /**
   * `navigate(url, options)` when the first argument starts with '/' or with a
   * scheme and '//'; otherwise `navigate(name, params, options)`. Both promises
   * resolve false when superseded or aborted and never reject with AbortError.
   * @param {string} nameOrUrl
   * @param {Record<string, string | number> | NavigateOptions} [params]
   * @param {NavigateOptions} [options]
   * @returns {{ committed: Promise<boolean>, finished: Promise<boolean> }}
   */
  navigate(nameOrUrl, params, options) {
    const isUrl = typeof nameOrUrl === 'string' && URL_FORM.test(nameOrUrl);
    const navigateOptions = (isUrl ? params : options) ?? {};
    const href = isUrl ? this.#urlTarget(nameOrUrl, navigateOptions) : this.url(nameOrUrl, params, navigateOptions);
    const { history = 'auto', info, state } = navigateOptions;
    return this.#navigateDriver(href, { history, info, state: withMarker(state) }, newChain());
  }

  /**
   * @param {string} name
   * @param {Record<string, string | number>} [params] Missing persistParams are copied from the current match.
   * @param {{ query?: URLSearchParams | Record<string, string> | string }} [options]
   * @returns {string}
   */
  url(name, params = {}, options = {}) {
    return this.#matcher.url(name, this.#withPersisted(name, params), options);
  }

  /**
   * Route and alias matches only; the notFound scope is a dispatch policy.
   * Navigation fields that need a navigation (`navigationType`, `signal`) are null.
   * @param {URL | string} url
   * @returns {Match | null}
   */
  match(url) {
    const result = this.#matcher.match(url);
    if (!result) return null;
    const idle = { navigationType: null, initial: false, info: undefined, signal: null, userInitiated: false };
    return toMatch(result, idle, '', undefined);
  }

  /** @returns {Match | null} */
  getCurrent() {
    return this.#current;
  }

  /** @returns {Promise<boolean>} */
  refresh() {
    if (!this.#session) return Promise.resolve(false);
    const entry = this.#driver.currentEntry;
    if (!this.#claims(new URL(entry.url))) return Promise.resolve(false);
    return this.#navigateDriver(entry.url, { history: 'replace', state: entry.getState() }, newChain()).finished;
  }

  /**
   * @param {import('./matcher.js').RouteDefinition[]} routes
   * @param {{ parent?: string }} [options]
   * @returns {() => void}
   */
  mount(routes, options) {
    return this.#matcher.mount(routes, options);
  }

  getAliases() {
    return this.#matcher.getAliases();
  }

  /** @param {string} name */
  getParamNames(name) {
    return this.#matcher.getParamNames(name);
  }

  /** @returns {boolean} */
  get canGoBack() {
    const driver = this.#driver;
    const { index } = driver.currentEntry;
    return index > 0 && isMarked(driver.entries()[index - 1].getState());
  }

  /** @returns {Promise<boolean>} false when there is no router-owned entry. */
  back() {
    if (!this.canGoBack) return Promise.resolve(false);
    return this.#settle(this.#driver.back(), newChain()).finished;
  }

  /** @param {any} state Merged into the current entry's persisted state. */
  updateState(state) {
    assertState(state);
    const entry = this.#driver.currentEntry;
    const stored = entry.getState();
    const next = { ...(isObject(stored) ? stored : {}), ...state };
    this.#driver.updateCurrentEntry({ state: next });
    if (this.#current?.key === entry.key) this.#current.state = publicState(next);
  }

  #withPersisted(name, params) {
    const current = this.#current;
    if (!current || !this.#options.persistParams.length) return params;
    const names = this.#matcher.getParamNames(name);
    const persisted = this.#options.persistParams
      .filter(key => names.includes(key) && (params[key] === undefined || params[key] === null) && key in current.params)
      .map(key => [key, current.params[key]]);
    return { ...Object.fromEntries(persisted), ...params };
  }

  #urlTarget(url, { query }) {
    const target = new URL(url, this.#driver.currentEntry.url);
    if (query !== undefined) target.search = toSearchParams(query).toString();
    return target.href;
  }

  #navigateDriver(href, options, chain) {
    this.#chain = chain;
    try {
      return this.#settle(this.#driver.navigate(href, options), chain);
    } finally {
      this.#chain = null;
    }
  }

  // A navigation superseded by its own redirect resolves with the redirect's outcome.
  #settle(result, chain) {
    const follow = (ok, key) => (ok || !chain.followUp ? ok : chain.followUp[key]);
    const committed = outcome(result.committed).then(ok => follow(ok, 'committed'));
    const finished = outcome(result.finished).then(ok => follow(ok, 'finished'));
    committed.catch(noop);
    finished.catch(noop);
    return { committed, finished };
  }

  #takeChain() {
    const chain = this.#chain ?? newChain();
    this.#chain = null;
    return chain;
  }

  #abortLocal() {
    this.#local?.abort();
    this.#local = null;
  }

  #intercepts(event, url) {
    if (!event.canIntercept || event.hashChange) return false;
    if (event.downloadRequest !== null || event.formData !== null) return false;
    return url.origin === new URL(this.#driver.currentEntry.url).origin;
  }

  #claims(url) {
    if (!this.#options.intercept(url)) return false;
    return Boolean(this.#matcher.match(url) ?? this.#options.notFound?.within(url));
  }

  #onNavigate(event) {
    const chain = this.#takeChain();
    const url = new URL(event.destination.url);
    if (!this.#intercepts(event, url)) return;
    const nav = this.#navigationFor(event, url, chain);
    const plan = this.#plan(nav);
    if (!plan) return;
    this.#abortLocal();
    event.intercept({ handler: () => this.#execute(plan, nav), focusReset: 'manual', scroll: 'manual' });
  }

  #navigationFor(event, url, chain) {
    return {
      url,
      chain,
      signal: AbortSignal.any([event.signal, this.#session.controller.signal]),
      navigationType: event.navigationType,
      initial: chain.initial,
      info: event.info,
      userInitiated: event.userInitiated,
      key: event.destination.key,
      rawState: event.destination.getState(),
      match: null,
    };
  }

  async #dispatchInitial(session) {
    const entry = this.#driver.currentEntry;
    const local = new AbortController();
    this.#local = local;
    const nav = {
      url: new URL(entry.url),
      chain: newChain(true),
      signal: AbortSignal.any([local.signal, session.controller.signal]),
      navigationType: 'push',
      initial: true,
      info: undefined,
      userInitiated: false,
      key: entry.key,
      rawState: entry.getState(),
      match: null,
    };
    const plan = this.#plan(nav);
    if (!plan) return false;
    if (plan.hop) return this.#hop(plan.hop, nav).finished;
    try {
      await this.#run(plan, nav);
    } catch(error) {
      if (!this.#isCurrent(nav)) return false;
      throw error;
    }
    return nav.chain.followUp ? nav.chain.followUp.finished : this.#isCurrent(nav);
  }

  /*
   * A plan is null (not the router's), `{ hop }` (replace the URL first), or
   * `{ base, pending }` (dispatch; `pending` is an async redirect in flight).
   */
  #plan(nav) {
    const { url } = nav;
    if (!this.#options.intercept(url)) return null;
    const result = this.#matcher.match(url);
    if (!result) return this.#notFoundPlan(url);
    if (result.alias !== null && result.aliasPolicy === 'canonicalize') {
      const canonical = this.#matcher.url(result.name, result.params, { query: result.query });
      return { hop: `${ canonical }${ url.hash }` };
    }
    return this.#redirectPlan(result, nav);
  }

  #notFoundPlan(url) {
    const { notFound } = this.#options;
    if (!notFound?.within(url)) return null;
    return { base: notFoundBase(notFound.name, url), pending: null };
  }

  #redirectPlan(result, nav) {
    if (!result.redirect) return { base: result, pending: null };
    const target = this.#callRedirect(result, nav);
    if (isThenable(target)) return { base: result, pending: target };
    if (target === undefined || target === null) return { base: result, pending: null };
    try {
      this.#assertHopAllowed(nav);
      return { hop: this.#targetHref(target) };
    } catch(error) {
      return { base: result, pending: rejection(error) };
    }
  }

  #callRedirect(result, nav) {
    try {
      return result.redirect(toMatch(result, nav, nav.key, nav.rawState), { signal: nav.signal });
    } catch(error) {
      return rejection(error);
    }
  }

  #assertHopAllowed(nav) {
    const { maxRedirects } = this.#options;
    if (nav.chain.hops >= maxRedirects) throw new Error(`Redirect limit of ${ maxRedirects } exceeded`);
  }

  #targetHref(target) {
    if (typeof target !== 'string') return this.url(target.name, target.params, { query: target.query });
    const base = this.#driver.currentEntry.url;
    const url = new URL(target, base);
    if (url.origin !== new URL(base).origin) throw new Error(`Redirect target must be same-origin: ${ target }`);
    return url.href;
  }

  #hop(href, nav) {
    const chain = { initial: nav.chain.initial, hops: nav.chain.hops + 1, followUp: null };
    return this.#navigateDriver(href, { history: 'replace', state: nav.rawState, info: nav.info }, chain);
  }

  #execute(plan, nav) {
    if (!plan.hop) return this.#run(plan, nav);
    nav.chain.followUp = this.#hop(plan.hop, nav);
  }

  #isCurrent(nav) {
    return !nav.signal.aborted && this.#current === nav.match;
  }

  async #run(plan, nav) {
    const match = this.#commit(plan.base, nav);
    try {
      if (plan.pending && await this.#redirected(nav, plan.pending)) return;
      await this.#options.handler?.(match, { signal: match.signal });
    } catch(error) {
      if (this.#isCurrent(nav)) this.trigger('route:error', error, match);
      throw error;
    }
    if (this.#isCurrent(nav)) this.trigger('route:ready', match);
  }

  // True when the navigation was superseded or replaced by the redirect target.
  async #redirected(nav, pending) {
    const target = await pending;
    if (!this.#isCurrent(nav)) return true;
    if (target === undefined || target === null) return false;
    this.#assertHopAllowed(nav);
    nav.chain.followUp = this.#hop(this.#targetHref(target), nav);
    return true;
  }

  #commit(base, nav) {
    const entry = this.#driver.currentEntry;
    const match = toMatch(base, nav, entry.key, this.#mark(entry));
    nav.match = match;
    this.#current = match;
    this.trigger('route', match);
    return match;
  }

  #mark(entry) {
    const stored = entry.getState();
    if (isMarked(stored) || !(stored === undefined || stored === null || isObject(stored))) return stored;
    const marked = withMarker(stored);
    this.#driver.updateCurrentEntry({ state: marked });
    return marked;
  }
}

Object.assign(Router.prototype, Events);
