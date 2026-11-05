import { Application } from "marionette";
import { Matcher } from "./matcher.js";
import { toSearchParams } from "./query.js";
import { navigationDriver } from "./drivers/navigation.js";
const MARKER = "@mnjs/router";
const URL_FORM = /^(?:\/|[a-z][a-z\d+.-]*:\/\/)/i;
const noop = () => {
};
class NavigationCancelled extends DOMException {
  constructor() {
    super("Navigation superseded", "AbortError");
  }
}
const isObject = (value) => typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const isThenable = (value) => typeof value?.then === "function";
const isMarked = (state) => isObject(state) && state[MARKER] === true;
function newChain(initial = false, { focusReset, scroll } = {}) {
  for (const [name, value] of Object.entries({ focusReset, scroll })) {
    if (value !== void 0 && value !== "manual" && value !== "after-transition") {
      throw new TypeError(`${name} must be "manual" or "after-transition"`);
    }
  }
  return { initial, hops: 0, followUp: null, policy: {
    ...focusReset === void 0 ? {} : { focusReset },
    ...scroll === void 0 ? {} : { scroll }
  } };
}
function rejection(error) {
  const promise = Promise.reject(error);
  promise.catch(noop);
  return promise;
}
function assertState(state) {
  if (state !== void 0 && state !== null && !isObject(state)) {
    throw new TypeError("Entry state must be a plain object");
  }
}
function withMarker(state) {
  assertState(state);
  return { ...state, [MARKER]: true };
}
function publicState(state) {
  if (!isObject(state)) {
    return state ?? void 0;
  }
  const copy = { ...state };
  delete copy[MARKER];
  return copy;
}
function outcome(promise, chain) {
  return promise.then(() => true, (error) => {
    if (error?.name === "AbortError" && chain.failure?.error !== error) {
      return false;
    }
    throw error;
  });
}
function notFoundBase(name, params, url) {
  return { name, params, query: new URLSearchParams(url.search), url, meta: {}, branch: [] };
}
function toMatch(base, nav, key, rawState) {
  return {
    name: base.name,
    params: base.params,
    query: base.query,
    url: base.url,
    meta: base.meta,
    branch: base.branch,
    navigationType: nav.navigationType,
    initial: nav.initial,
    info: nav.info,
    state: publicState(rawState),
    key,
    signal: nav.signal,
    userInitiated: nav.userInitiated
  };
}
const states = /* @__PURE__ */ new WeakMap();
const stateFor = (router) => states.get(router);
function option(router, key) {
  return router.getOption(key);
}
function getMatcher(router) {
  const internals = stateFor(router);
  if (!internals.matcher) {
    const routes = option(router, "routes");
    internals.matcher = new Matcher(typeof routes === "function" ? routes.call(router) : routes, router);
  }
  return internals.matcher;
}
function canceledNavigation() {
  const canceled = Promise.resolve(false);
  return { committed: canceled, finished: canceled };
}
function stopRouting(router) {
  const internals = stateFor(router);
  const { local, currentController, session } = internals;
  internals.local = null;
  internals.currentController = null;
  internals.session = null;
  internals.traversals.clear();
  local?.abort();
  currentController?.abort();
  session?.controller.abort();
}
function constructRouter(options) {
  states.set(this, {
    matcher: null,
    resolvedDriver: null,
    session: null,
    local: null,
    chain: null,
    current: null,
    currentController: null,
    currentNavigation: null,
    pending: /* @__PURE__ */ new Set(),
    initialDispatch: null,
    traversals: /* @__PURE__ */ new Set()
  });
  this.on({ start: () => startRouting(this), "before:stop": () => stopRouting(this), "before:destroy": () => stopRouting(this) });
  Application.call(this, options);
  getMatcher(this);
}
function startRouting(router) {
  const internals = stateFor(router);
  if (!router.isRunning() || internals.session) {
    return;
  }
  const initial = Promise.withResolvers();
  internals.initialDispatch = initial.promise;
  try {
    const driver = getDriver(router);
    const session = { controller: new AbortController() };
    internals.session = session;
    driver.addEventListener("navigate", (event) => onNavigate(router, event), { signal: session.controller.signal });
    dispatchInitial(router, session).then(initial.resolve, (error) => initial.resolve({ status: "failed", error, match: null }));
  } catch (error) {
    initial.resolve({ status: "failed", error, match: null });
    stopRouting(router);
    try {
      router.stop();
    } catch (cleanupError) {
      queueMicrotask(() => {
        throw cleanupError;
      });
    }
    throw error;
  }
}
function getDriver(router) {
  const internals = stateFor(router);
  internals.resolvedDriver ??= option(router, "driver") ?? navigationDriver();
  return internals.resolvedDriver;
}
function entryState(router, href, history, state) {
  if (state !== void 0) {
    return withMarker(state);
  }
  const entry = getDriver(router).currentEntry;
  const current = new URL(entry.url);
  const target = new URL(href, current);
  const replaces = history === "replace" || history === "auto" && target.href === current.href;
  const existing = replaces && target.pathname === current.pathname ? entry.getState() : void 0;
  return withMarker(isObject(existing) ? existing : void 0);
}
function withPersisted(router, name, params) {
  const internals = stateFor(router);
  const current = internals.current;
  if (!current || !option(router, "persistParams").length) {
    return params;
  }
  const names = getMatcher(router).getParamNames(name);
  const persisted = option(router, "persistParams").filter((key) => names.includes(key) && !Object.hasOwn(params, key) && Object.hasOwn(current.params, key)).map((key) => [key, current.params[key]]);
  return { ...Object.fromEntries(persisted), ...params };
}
function urlTarget(router, url, { query }) {
  const target = new URL(url, getDriver(router).currentEntry.url);
  if (query !== void 0) {
    target.search = toSearchParams(query).toString();
  }
  return target.href;
}
function navigateDriver(router, href, options, chain) {
  const internals = stateFor(router);
  internals.chain = chain;
  try {
    return settle(getDriver(router).navigate(href, options), chain);
  } finally {
    internals.chain = null;
  }
}
function settle(result, chain) {
  const follow = (ok, key) => ok || !chain.followUp ? ok : chain.followUp[key];
  const committed = outcome(result.committed, chain).then((ok) => follow(ok, "committed"));
  const finished = outcome(result.finished, chain).then((ok) => follow(ok, "finished"));
  committed.catch(noop);
  finished.catch(noop);
  return { committed, finished };
}
function takeChain(router, event) {
  const internals = stateFor(router);
  if (event.navigationType === "traverse") {
    const request = [...internals.traversals].find((item) => item.key === event.destination.key);
    if (request) {
      internals.traversals.delete(request);
      return request.chain;
    }
  }
  const chain = internals.chain ?? newChain();
  internals.chain = null;
  return chain;
}
function abortLocal(router) {
  const internals = stateFor(router);
  internals.local?.abort();
  internals.local = null;
}
function intercepts(router, event, url) {
  if (event.defaultPrevented || event.signal.aborted || !event.canIntercept || event.hashChange || event.navigationType === "reload") {
    return false;
  }
  if (event.downloadRequest !== null || event.formData !== null) {
    return false;
  }
  return url.origin === new URL(getDriver(router).currentEntry.url).origin;
}
function claims(router, url) {
  if (!option(router, "intercept").call(router, url)) {
    return false;
  }
  return Boolean(getMatcher(router).match(url) ?? option(router, "notFound")?.within(url));
}
function onNavigate(router, event) {
  const chain = takeChain(router, event);
  const url = new URL(event.destination.url);
  if (!intercepts(router, event, url)) {
    return;
  }
  const nav = navigationFor(router, event, url, chain);
  let task;
  try {
    const plan = planNavigation(router, nav);
    if (!plan) {
      nav.release();
      return;
    }
    task = () => execute(router, plan, nav);
  } catch (error) {
    task = () => {
      throw error;
    };
  }
  abortLocal(router);
  event.intercept({ handler: () => waitForAttempt(router, nav, task), ...chain.policy });
}
function navigationFor(router, event, url, chain) {
  const internals = stateFor(router);
  const controller = new AbortController();
  const nav = {
    url,
    chain,
    controller,
    signal: AbortSignal.any([event.signal, internals.session.controller.signal, controller.signal]),
    navigationType: event.navigationType,
    initial: chain.initial,
    info: event.info,
    userInitiated: event.userInitiated,
    key: event.destination.key,
    rawState: event.destination.getState(),
    match: null
  };
  registerPending(router, nav);
  return nav;
}
function registerPending(router, nav) {
  const pending = stateFor(router).pending;
  const release = nav.release = () => {
    pending.delete(nav);
    nav.signal.removeEventListener("abort", release);
  };
  pending.add(nav);
  nav.signal.addEventListener("abort", release, { once: true });
  if (nav.signal.aborted) {
    release();
  }
}
function dispatchInitial(router, session) {
  const internals = stateFor(router);
  const driver = getDriver(router);
  const entry = driver.currentEntry;
  const local = new AbortController();
  const controller = new AbortController();
  internals.local = local;
  const nav = {
    url: new URL(entry.url),
    chain: newChain(true),
    controller,
    signal: AbortSignal.any([local.signal, session.controller.signal, controller.signal]),
    navigationType: driver.activation?.navigationType ?? "push",
    initial: true,
    info: void 0,
    userInitiated: false,
    key: entry.key,
    rawState: entry.getState(),
    match: null
  };
  nav.chain.dispatch = { match: null };
  registerPending(router, nav);
  return initialOutcome(router, nav);
}
async function initialOutcome(router, nav) {
  try {
    try {
      await waitForAttempt(router, nav, async () => {
        const plan = planNavigation(router, nav);
        if (plan) {
          await execute(router, plan, nav);
        }
      });
    } catch (error) {
      if (!nav.chain.followUp) {
        throw error;
      }
    }
    const finished = nav.chain.followUp ? await nav.chain.followUp.finished : !nav.signal.aborted;
    if (!finished) {
      return { status: "cancelled" };
    }
    const match = nav.chain.dispatch.match;
    return match ? { status: "matched", match } : { status: "unmatched" };
  } catch (error) {
    if (error instanceof NavigationCancelled) {
      return { status: "cancelled" };
    }
    return { status: "failed", error, match: nav.chain.dispatch.match };
  }
}
function planNavigation(router, nav) {
  const { url } = nav;
  if (!option(router, "intercept").call(router, url)) {
    return null;
  }
  const result = getMatcher(router).match(url);
  if (!result) {
    return notFoundPlan(router, url);
  }
  return redirectPlan(router, result, nav);
}
function notFoundPlan(router, url) {
  const notFound = option(router, "notFound");
  if (!notFound?.within(url)) {
    return null;
  }
  return { base: notFoundBase(notFound.name, getMatcher(router).matchPrefix(url), url), pending: null };
}
function redirectPlan(router, result, nav) {
  nav.registration = result.registration;
  const handler = result.handler;
  if (!result.redirect) {
    return { base: result, pending: null, handler };
  }
  const target = callRedirect(result, nav);
  if (isThenable(target)) {
    const pending = Promise.resolve(target);
    pending.catch(noop);
    return { base: result, pending, handler };
  }
  if (target === void 0 || target === null) {
    return { base: result, pending: null, handler };
  }
  try {
    assertHopAllowed(router, nav);
    return { hop: targetHref(router, target, nav.url) };
  } catch (error) {
    return { base: result, pending: rejection(error), handler };
  }
}
function callRedirect(result, nav) {
  try {
    return result.redirect(toMatch(result, nav, nav.key, nav.rawState), { signal: nav.signal });
  } catch (error) {
    return rejection(error);
  }
}
function assertHopAllowed(router, nav) {
  const maxRedirects = option(router, "maxRedirects");
  if (nav.chain.hops >= maxRedirects) {
    throw new Error(`Redirect limit of ${maxRedirects} exceeded`);
  }
}
function targetHref(router, target, base) {
  if (typeof target !== "string") {
    return router.url(target.name, target.params, { query: target.query });
  }
  const url = new URL(target, base);
  if (url.origin !== base.origin) {
    throw new Error(`Redirect target must be same-origin: ${target}`);
  }
  return url.href;
}
function hop(router, href, nav) {
  const chain = { initial: nav.chain.initial, hops: nav.chain.hops + 1, followUp: null, policy: nav.chain.policy, dispatch: nav.chain.dispatch };
  if (chain.dispatch) {
    chain.dispatch.match = null;
  }
  return navigateDriver(router, href, { history: "replace", state: nav.rawState, info: nav.info }, chain);
}
function execute(router, plan, nav) {
  if (plan.hop === void 0) {
    return run(router, plan, nav);
  }
  nav.chain.followUp = hop(router, plan.hop, nav);
}
function isCurrent(router, nav) {
  const internals = stateFor(router);
  return !nav.signal.aborted && internals.current === nav.match;
}
async function attempt(router, nav, task) {
  try {
    if (nav.signal.aborted) {
      throw new NavigationCancelled();
    }
    await task();
  } catch (error) {
    if (nav.signal.aborted || nav.match && !isCurrent(router, nav)) {
      throw new NavigationCancelled();
    }
    nav.chain.failure = { error };
    reportError(router, error, nav.match);
    throw error;
  } finally {
    nav.release();
  }
}
function reportError(router, error, match) {
  try {
    router.triggerMethod("route:error", error, match);
  } catch (notificationError) {
    queueMicrotask(() => {
      throw notificationError;
    });
  }
}
function waitForAttempt(router, nav, task) {
  return cancellable(attempt(router, nav, task), nav.signal).finally(() => nav.release());
}
function cancellable(work, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new NavigationCancelled());
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) {
      abort();
    }
  });
}
function reconcileRegistrations(router) {
  const internals = stateFor(router);
  const candidates = new Set(internals.pending);
  if (internals.currentNavigation) {
    candidates.add(internals.currentNavigation);
  }
  const removed = [...candidates].filter((nav) => nav.registration && !getMatcher(router).hasRegistration(nav.registration));
  if (internals.currentNavigation && removed.includes(internals.currentNavigation)) {
    internals.current = null;
    internals.currentController = null;
    internals.currentNavigation = null;
  }
  for (const nav of removed) {
    nav.controller.abort();
  }
}
async function run(router, plan, nav) {
  const match = commit(router, plan.base, nav);
  if (!match) {
    throw new NavigationCancelled();
  }
  if (plan.pending && await redirected(router, nav, plan.pending)) {
    return;
  }
  if (!isCurrent(router, nav)) {
    throw new NavigationCancelled();
  }
  await (plan.handler ?? option(router, "handler"))?.call(router, match, { signal: match.signal });
  if (!isCurrent(router, nav)) {
    throw new NavigationCancelled();
  }
  router.triggerMethod("route:ready", match);
}
async function redirected(router, nav, pending) {
  const target = await pending;
  if (!isCurrent(router, nav)) {
    throw new NavigationCancelled();
  }
  if (target === void 0 || target === null) {
    return false;
  }
  assertHopAllowed(router, nav);
  nav.chain.followUp = hop(router, targetHref(router, target, nav.url), nav);
  return true;
}
function commit(router, base, nav) {
  const internals = stateFor(router);
  const entry = getDriver(router).currentEntry;
  const previous = internals.currentController;
  const match = toMatch(base, nav, entry.key, mark(router, entry));
  nav.match = match;
  internals.current = match;
  internals.currentController = nav.controller;
  internals.currentNavigation = nav;
  if (nav.chain.dispatch) {
    nav.chain.dispatch.match = match;
  }
  previous?.abort();
  if (!isCurrent(router, nav)) {
    return null;
  }
  router.triggerMethod("route", match);
  return isCurrent(router, nav) ? match : null;
}
function mark(router, entry) {
  const stored = entry.getState();
  if (isMarked(stored) || !(stored === void 0 || stored === null || isObject(stored))) {
    return stored;
  }
  const marked = withMarker(stored);
  getDriver(router).updateCurrentEntry({ state: marked });
  return marked;
}
const Router = Application.extend({
  constructor: constructRouter,
  routes: [],
  persistParams: [],
  maxRedirects: 5,
  intercept: () => true,
  navigate(nameOrUrl, params, options) {
    const internals = stateFor(this);
    if (!internals.session) {
      return canceledNavigation();
    }
    const isUrl = typeof nameOrUrl === "string" && URL_FORM.test(nameOrUrl);
    const navigateOptions = (isUrl ? params : options) ?? {};
    const chain = newChain(false, navigateOptions);
    const href = isUrl ? urlTarget(this, nameOrUrl, navigateOptions) : this.url(nameOrUrl, params, navigateOptions);
    const { history = "auto", info, state } = navigateOptions;
    return navigateDriver(this, href, { history, info, state: entryState(this, href, history, state) }, chain);
  },
  url(name, params = {}, options = {}) {
    return getMatcher(this).url(name, withPersisted(this, name, params), options);
  },
  match(url) {
    const target = url instanceof URL ? url : new URL(url, URL.canParse(url) ? void 0 : getDriver(this).currentEntry.url);
    const result = getMatcher(this).match(target);
    if (!result) {
      return null;
    }
    const idle = { navigationType: null, initial: false, info: void 0, signal: null, userInitiated: false };
    return toMatch(result, idle, "", void 0);
  },
  getCurrent() {
    const internals = stateFor(this);
    return internals.current;
  },
  getInitialDispatch() {
    return stateFor(this).initialDispatch;
  },
  async refresh() {
    const internals = stateFor(this);
    if (!internals.session) {
      return Promise.resolve(false);
    }
    const entry = getDriver(this).currentEntry;
    try {
      if (!claims(this, new URL(entry.url))) {
        return false;
      }
    } catch (error) {
      reportError(this, error, null);
      throw error;
    }
    return navigateDriver(this, entry.url, { history: "replace", state: entry.getState() }, newChain(false, { focusReset: "manual", scroll: "manual" })).finished;
  },
  mount(routes, options) {
    const owner = options?.owner;
    if (owner?.isDestroyed()) {
      throw new Error("Cannot mount routes for a destroyed owner");
    }
    const remove = getMatcher(this).mount(routes, options);
    let mounted = true;
    const unmount = () => {
      if (!mounted) {
        return;
      }
      mounted = false;
      owner?.off("before:destroy", unmount);
      this.off("before:destroy", unmount);
      remove();
      reconcileRegistrations(this);
    };
    owner?.on("before:destroy", unmount);
    this.on("before:destroy", unmount);
    if (owner?.isDestroyed()) {
      unmount();
    }
    return unmount;
  },
  getParamNames(name) {
    return getMatcher(this).getParamNames(name);
  },
  hasRoute(name) {
    return getMatcher(this).has(name);
  },
  back() {
    const internals = stateFor(this);
    if (!this.canGoBack()) {
      return Promise.resolve(false);
    }
    const driver = getDriver(this);
    const request = { key: driver.entries()[driver.currentEntry.index - 1].key, chain: newChain() };
    internals.traversals.add(request);
    try {
      return settle(driver.back(), request.chain).finished.finally(() => internals.traversals.delete(request));
    } catch (error) {
      internals.traversals.delete(request);
      throw error;
    }
  },
  updateState(state) {
    if (!stateFor(this).session) {
      return false;
    }
    const internals = stateFor(this);
    assertState(state);
    const entry = getDriver(this).currentEntry;
    const stored = entry.getState();
    const next = { ...isObject(stored) ? stored : {}, ...state };
    getDriver(this).updateCurrentEntry({ state: next });
    if (internals.current?.key === entry.key) {
      internals.current.state = publicState(next);
    }
    return true;
  },
  canGoBack() {
    const internals = stateFor(this);
    if (!internals.session) {
      return false;
    }
    const driver = getDriver(this);
    const { index } = driver.currentEntry;
    return index > 0 && isMarked(driver.entries()[index - 1].getState());
  }
});
export {
  Router
};
