/**
 * In-memory Driver for tests (contract: see ./navigation.js). Events fire in the
 * same order as the native API with deterministic timing, including supersession
 * (a new navigation aborts the previous event's signal before its own event
 * dispatches, even if a listener then cancels it) and traversal.
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
 * Timing: `navigate`, `reload` and `simulate` dispatch the event and commit
 * synchronously; `back` and `traverseTo` dispatch in a microtask, as the native
 * API queues traversals. Returned promises are marked handled so an ignored
 * rejection never surfaces as an unhandled rejection.
 *
 * @param {{ url?: string }} [options] Initial URL, default 'http://localhost/'.
 * @returns {import('./navigation.js').Driver & {
 *   simulate: Function, documentNavigations: string[]
 * }}
 */
export function memoryDriver(options = {}) {
  const { url = 'http://localhost/' } = options;
  const history = new MemoryHistory(new URL(url).href);

  return {
    capabilities: { cancelTraverse: true, interceptsLinks: true },
    get currentEntry() {
      return history.current;
    },
    documentNavigations: history.documentNavigations,
    entries: () => history.entries.slice(),
    navigate: (target, navigateOptions) => history.navigate(target, navigateOptions),
    reload: reloadOptions => history.reload(reloadOptions),
    back: () => history.back(),
    traverseTo: key => history.traverseTo(key),
    updateCurrentEntry: updateOptions => history.updateCurrentEntry(updateOptions),
    addEventListener: (type, listener, listenerOptions) => history.addEventListener(type, listener, listenerOptions),
    simulate: (target, simulateOptions) => history.simulate(target, simulateOptions),
  };
}

const HISTORY_MODES = ['auto', 'push', 'replace'];
const SIMULATED_TYPES = ['push', 'replace'];

const states = new WeakMap();

const noop = () => {};

const domError = (message, name) => new DOMException(message, name);

function deferred() {
  const result = {};
  result.promise = new Promise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  result.promise.catch(noop);
  return result;
}

function rejected(error) {
  const committed = Promise.reject(error);
  const finished = Promise.reject(error);
  committed.catch(noop);
  finished.catch(noop);
  return { committed, finished };
}

function resolved(entry) {
  return { committed: Promise.resolve(entry), finished: Promise.resolve(entry) };
}

function resolveUrl(target, base) {
  try {
    return new URL(target, base).href;
  } catch {
    throw domError(`Invalid URL: ${ target }`, 'SyntaxError');
  }
}

function sameOrigin(url, from) {
  return new URL(url).origin === new URL(from).origin;
}

function withoutHash(url) {
  const copy = new URL(url);
  copy.hash = '';
  return copy.href;
}

function isHashChange(url, from) {
  return new URL(url).hash !== '' && url !== from && withoutHash(url) === withoutHash(from);
}

function invoke(handler) {
  try {
    return Promise.resolve(handler());
  } catch(error) {
    return Promise.reject(error);
  }
}

function createEntry(entries, { url, key, state }) {
  const entry = {
    url,
    key,
    get index() {
      return entries.indexOf(entry);
    },
    getState: () => structuredClone(states.get(entry)),
  };
  states.set(entry, state);
  return entry;
}

function createInit(overrides) {
  return {
    cancelable: true,
    canIntercept: true,
    hashChange: false,
    userInitiated: false,
    downloadRequest: null,
    formData: null,
    info: undefined,
    ...overrides,
  };
}

function eventFlags(flags, url, from) {
  const { canIntercept = sameOrigin(url, from), hashChange = isHashChange(url, from) } = flags;
  const { info, userInitiated = false, downloadRequest = null, formData = null } = flags;
  return { info, userInitiated, downloadRequest, formData, canIntercept, hashChange };
}

class Navigation {
  controller = new AbortController();
  committed = deferred();
  finished = deferred();
  handlers = [];
  dispatching = false;
  canceled = false;
  intercepted = false;
  settled = false;

  get result() {
    return { committed: this.committed.promise, finished: this.finished.promise };
  }

  succeed(entry) {
    if (this.settled) return;
    this.settled = true;
    this.finished.resolve(entry);
  }

  fail(error) {
    if (this.settled) return;
    this.settled = true;
    this.finished.reject(error);
  }

  abort(error = domError('Navigation aborted', 'AbortError')) {
    if (this.settled) return;
    this.controller.abort(error);
    this.committed.reject(error);
    this.fail(error);
  }

  intercept(handler, canIntercept) {
    if (!canIntercept) {
      throw domError('This navigation cannot be intercepted', 'SecurityError');
    }
    if (!this.dispatching || this.canceled) {
      throw domError('intercept() is only available while the navigate event is dispatching', 'InvalidStateError');
    }
    this.intercepted = true;
    if (handler) this.handlers.push(handler);
  }
}

function createEvent(navigation, init, destination) {
  const { navigationType, canIntercept, hashChange, downloadRequest, formData, userInitiated, info, cancelable } = init;
  return {
    destination,
    navigationType,
    canIntercept,
    hashChange,
    downloadRequest,
    formData,
    userInitiated,
    info,
    cancelable,
    signal: navigation.controller.signal,
    get defaultPrevented() {
      return navigation.canceled;
    },
    preventDefault() {
      if (cancelable && navigation.dispatching) navigation.canceled = true;
    },
    intercept({ handler } = {}) {
      navigation.intercept(handler, canIntercept);
    },
  };
}

class MemoryHistory {
  entries = [];
  documentNavigations = [];
  #position = 0;
  #keys = 0;
  #listeners = new Set();
  #active = new Set();

  constructor(url) {
    this.entries.push(this.#createEntry(url));
  }

  get current() {
    return this.entries[this.#position];
  }

  navigate(target, { history = 'auto', state, info } = {}) {
    if (!HISTORY_MODES.includes(history)) {
      throw new TypeError(`Invalid history mode: ${ history }`);
    }
    return this.#navigateTo(target, { history, state, info });
  }

  simulate(target, { navigationType = 'push', userInitiated = true, canIntercept = true, ...flags } = {}) {
    if (!SIMULATED_TYPES.includes(navigationType)) {
      throw new TypeError(`Cannot simulate navigationType: ${ navigationType }`);
    }
    return this.#navigateTo(target, { history: navigationType, userInitiated, canIntercept, ...flags });
  }

  reload({ info, state } = {}) {
    let nextState = states.get(this.current);
    try {
      if (state !== undefined) nextState = structuredClone(state);
    } catch(error) {
      return rejected(error);
    }
    return this.#start(createInit({ navigationType: 'reload', url: this.current.url, state: nextState, info }));
  }

  back() {
    if (this.#position === 0) {
      return rejected(domError('There is no previous entry', 'InvalidStateError'));
    }
    return this.traverseTo(this.entries[this.#position - 1].key);
  }

  traverseTo(key) {
    const target = this.#find(key);
    if (!target) return rejected(this.#missingEntry(key));
    if (target === this.current) return resolved(target);

    const navigation = new Navigation();
    queueMicrotask(() => this.#traverse(key, navigation));
    return navigation.result;
  }

  updateCurrentEntry({ state }) {
    states.set(this.current, structuredClone(state));
  }

  addEventListener(type, listener, { signal } = {}) {
    if (type !== 'navigate') {
      throw new TypeError(`Unsupported event type: ${ type }`);
    }
    if (this.#listeners.has(listener) || signal?.aborted) return;

    this.#listeners.add(listener);
    signal?.addEventListener('abort', () => this.#listeners.delete(listener), { once: true });
  }

  #createEntry(url, state, key = `entry-${ ++this.#keys }`) {
    return createEntry(this.entries, { url, key, state });
  }

  #find(key) {
    return this.entries.find(entry => entry.key === key);
  }

  #missingEntry(key) {
    return domError(`There is no entry with key ${ key }`, 'InvalidStateError');
  }

  #navigateTo(target, { history, state, ...flags }) {
    const from = this.current.url;
    let url;
    let clonedState;
    try {
      url = resolveUrl(target, from);
      clonedState = structuredClone(state);
    } catch(error) {
      return rejected(error);
    }

    const navigationType = history === 'auto' ? this.#autoType(url) : history;
    return this.#start(createInit({ navigationType, url, state: clonedState, ...eventFlags(flags, url, from) }));
  }

  #autoType(url) {
    return url === this.current.url ? 'replace' : 'push';
  }

  #traverse(key, navigation) {
    const target = this.#find(key);
    if (!target) {
      navigation.abort(this.#missingEntry(key));
      return;
    }
    if (target === this.current) {
      navigation.committed.resolve(target);
      navigation.succeed(target);
      return;
    }

    const from = this.current.url;
    this.#start(createInit({
      navigationType: 'traverse',
      url: target.url,
      target,
      canIntercept: sameOrigin(target.url, from),
      hashChange: isHashChange(target.url, from),
    }), navigation);
  }

  #start(init, navigation = new Navigation()) {
    this.#supersedeOthers(navigation);
    this.#active.add(navigation);
    navigation.dispatching = true;
    this.#dispatch(createEvent(navigation, init, this.#destination(init)));
    navigation.dispatching = false;

    if (navigation.canceled) navigation.abort();
    if (navigation.settled) return navigation.result;

    const entry = this.#commit(init);
    navigation.committed.resolve(entry);
    this.#finish(navigation, entry);
    return navigation.result;
  }

  #finish(navigation, entry) {
    if (!navigation.intercepted) {
      this.documentNavigations.push(entry.url);
      navigation.succeed(entry);
      return;
    }

    Promise.all(navigation.handlers.map(invoke)).then(
      () => navigation.succeed(entry),
      error => navigation.fail(error),
    );
  }

  #destination({ url, state, target }) {
    if (target) {
      return { url, key: target.key, index: target.index, getState: target.getState };
    }
    return { url, key: '', index: -1, getState: () => structuredClone(state) };
  }

  #supersedeOthers(navigation) {
    for (const other of this.#active) {
      if (other === navigation) continue;
      other.abort();
      this.#active.delete(other);
    }
  }

  #commit({ navigationType, url, state, target }) {
    if (navigationType === 'traverse') {
      this.#position = this.entries.indexOf(target);
      return target;
    }
    if (navigationType === 'push') {
      const entry = this.#createEntry(url, state);
      this.entries.splice(this.#position + 1, Infinity, entry);
      this.#position += 1;
      return entry;
    }

    const entry = this.#createEntry(url, state, this.current.key);
    this.entries[this.#position] = entry;
    return entry;
  }

  #dispatch(event) {
    for (const listener of [...this.#listeners]) {
      if (!this.#listeners.has(listener)) continue;
      try {
        listener(event);
      } catch(error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }
}
