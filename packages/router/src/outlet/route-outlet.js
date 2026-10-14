import { MnObject } from 'marionette';
import { RouteState } from './route-state.js';
import { isEqual } from './is-equal.js';

/**
 * Keeps exactly one selected child Application of `owner`. Semantics: DESIGN.md
 * "RouteOutlet"; ported from src/js/base/route-base-app.js.
 */
export class RouteOutlet extends MnObject {
  #owner;
  #onCleanupError;
  #selection = null;
  #intent = null;

  /**
   * @param {{ owner: object, onCleanupError?: (error: Error, app: object) => void }} options
   */
  constructor(options) {
    super(options);
    this.#owner = options.owner;
    this.#onCleanupError = options.onCleanupError ?? (() => {});
    this.#listenToOwner();
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

  /** @returns {boolean} Invalidates pending selection and stops the current child. */
  stop() {
    this.#invalidate();
    this.#stopSelection();
    return true;
  }

  /** @returns {object | null} */
  getCurrent() {
    return this.#selection?.app ?? null;
  }

  onDestroy() {
    this.#invalidate();
  }

  // An owner that is already stopped emits nothing when stopped again; Marionette
  // still stops its children, which cancels their pending starts.
  #listenToOwner() {
    this.listenTo(this.#owner, {
      'before:start': this.#onOwnerBeforeStart,
      'before:stop': this.#invalidate,
      'stop': this.#onOwnerStop,
      'before:destroy': this.#invalidate,
      'destroy': this.#onOwnerDestroy,
    });
  }

  // Restarting a running owner invalidates pending selection. A first start is
  // indistinguishable from a restart of a stopped owner, so it must not.
  #onOwnerBeforeStart(owner) {
    if (owner.isRunning()) this.#invalidate();
  }

  #onOwnerStop() {
    if (!this.#intent) this.#clearSelection();
  }

  #onOwnerDestroy() {
    this.#clearSelection();
    this.destroy();
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

    this.#stopSelection();
    if (this.#intent !== intent) return;

    const selected = { app, appName, key, route: new RouteState(match) };
    this.#selection = selected;
    return this.#activate(intent, selected, options);
  }

  #canReuse(appName, key) {
    const current = this.#selection;
    return current?.appName === appName && isEqual(current.key, key);
  }

  async #activate(intent, selection, options) {
    const { app, route } = selection;

    try {
      const started = await app.start({ ...options, route });
      if (this.#intent !== intent) return;
      if (started) return app;

      // A superseding child restart may still own a live run; keep it selected
      // so the next selection can stop it.
      if (!app.isRunning()) this.#cleanup(selection);
    } catch(error) {
      if (this.#intent !== intent) return;

      // Failed preparation can leave started descendants running.
      this.#cleanup(selection);
      throw error;
    }
  }

  #cleanup({ app }) {
    try {
      this.#stopSelection();
    } catch(error) {
      this.#onCleanupError(error, app);
    }
  }

  #stopSelection() {
    const selection = this.#selection;
    if (!selection) return;

    selection.app.stop();
    if (this.#selection === selection) this.#clearSelection();
  }

  #clearSelection() {
    const selection = this.#selection;
    this.#selection = null;
    selection?.route.destroy();
  }
}
