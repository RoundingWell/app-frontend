import { MnObject } from 'marionette';
import { RouteState } from './route-state.js';
import { isEqual } from './is-equal.js';

function isThenable(value) {
  return typeof value?.then === 'function';
}

/**
 * Keeps exactly one selected child Application of `owner`. Semantics: DESIGN.md
 * "RouteOutlet"; ported from src/js/base/route-base-app.js.
 */
export class RouteOutlet extends MnObject {
  #owner;
  #onCleanupError;
  #selection = null;
  #intent = null;
  #stopping = null;

  /**
   * @param {{ owner: object, onCleanupError?: (error: Error, app: object) => void }} options
   */
  constructor(options) {
    super(options);
    this.#owner = options.owner;
    this.#onCleanupError = options.onCleanupError ?? (() => {});
    this.#guardOwner();
  }

  /**
   * @param {string} appName Registered child Application of the owner.
   * @param {{ key?: object, match: import('../router.js').Match, restart?: boolean, options?: object }} selection
   * @returns {Promise<object | undefined>} The running child, or undefined when superseded or canceled.
   */
  async show(appName, selection) {
    const app = this.#owner.getChildApp(appName);
    if (!app) throw new Error(`Child application "${ appName }" is not registered`);

    const intent = {};
    this.#intent = intent;

    try {
      return await this.#select(intent, app, appName, selection);
    } catch(error) {
      if (this.#intent !== intent) return;
      throw error;
    }
  }

  /** @returns {Promise<boolean> | boolean} Invalidates pending selection and stops the current child. */
  stop() {
    this.#invalidate();
    return this.#stopSelection();
  }

  /** @returns {object | null} */
  getCurrent() {
    return this.#selection?.app ?? null;
  }

  onDestroy() {
    this.#invalidate();
  }

  // Marionette emits no notifications when an already-stopped owner is stopped
  // again, so the owner's methods are the only reliable invalidation point.
  #guardOwner() {
    const owner = this.#owner;
    const { stop, restart, destroy } = owner;

    owner.stop = (...args) => {
      this.#invalidate();
      return this.#afterOwnerStop(stop.apply(owner, args));
    };

    owner.restart = (...args) => {
      this.#invalidate();
      return restart.apply(owner, args);
    };

    owner.destroy = (...args) => {
      this.#invalidate();
      const result = this.#afterOwnerStop(destroy.apply(owner, args));
      this.destroy();
      return result;
    };
  }

  #afterOwnerStop(stopped) {
    if (stopped && !this.#intent) this.#clearSelection();
    return stopped;
  }

  #invalidate() {
    this.#intent = null;
  }

  async #select(intent, app, appName, { key, match, restart = false, options }) {
    if (!restart && this.#canReuse(appName, key)) {
      const current = this.#selection;
      current.route.set(match);
      return this.#activate(intent, current, options);
    }

    const stopped = this.#stopSelection();
    const authorized = isThenable(stopped) ? await stopped : stopped;
    if (this.#intent !== intent || authorized !== true) return;

    const selected = { app, appName, key, route: new RouteState(match) };
    this.#selection = selected;
    return this.#activate(intent, selected, options);
  }

  #canReuse(appName, key) {
    const current = this.#selection;
    return !this.#stopping && current?.appName === appName && isEqual(current.key, key);
  }

  async #activate(intent, selection, options) {
    const { app, route } = selection;

    try {
      const started = await app.start({ ...options, route });
      if (this.#intent !== intent) return;
      if (started) return app;

      // A superseding child restart may still own a live run; keep it selected
      // so the next selection can stop it.
      if (!app.isRunning()) await this.#cleanup(selection);
    } catch(error) {
      if (this.#intent !== intent) return;

      // Failed preparation can leave started descendants running.
      await this.#cleanup(selection);
      throw error;
    }
  }

  async #cleanup({ app }) {
    try {
      await this.#stopSelection();
    } catch(error) {
      this.#onCleanupError(error, app);
    }
  }

  #stopSelection() {
    const selection = this.#selection;
    if (!selection) return true;
    if (this.#stopping?.selection === selection) return this.#stopping.result;

    const result = selection.app.stop();
    if (!isThenable(result)) return this.#finishStop(selection, result);

    const tracked = Promise.resolve(result)
      .then(stopped => this.#finishStop(selection, stopped))
      .finally(() => {
        if (this.#stopping?.selection === selection) this.#stopping = null;
      });
    this.#stopping = { selection, result: tracked };
    return tracked;
  }

  #finishStop(selection, stopped) {
    if (stopped === true && this.#selection === selection) this.#clearSelection();
    return stopped;
  }

  #clearSelection() {
    const selection = this.#selection;
    this.#selection = null;
    selection?.route.destroy();
  }
}
