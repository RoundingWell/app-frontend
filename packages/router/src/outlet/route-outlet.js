import { MnObject } from 'marionette';

/**
 * Keeps exactly one selected child Application of `owner`. Semantics: DESIGN.md
 * "RouteOutlet"; ported from src/js/base/route-base-app.js.
 */
export class RouteOutlet extends MnObject {
  /**
   * @param {{ owner: object, onCleanupError?: (error: Error, app: object) => void }} options
   */
  constructor(options) {
    throw new Error('Not implemented');
  }

  /**
   * @param {string} appName Registered child Application of the owner.
   * @param {{ key?: object, match: import('../router.js').Match, restart?: boolean, options?: object }} selection
   * @returns {Promise<object | undefined>} The running child, or undefined when superseded or canceled.
   */
  show(appName, selection) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<boolean> | boolean} Invalidates pending selection and stops the current child. */
  stop() {
    throw new Error('Not implemented');
  }

  /** @returns {object | null} */
  getCurrent() {
    throw new Error('Not implemented');
  }
}
