import { MnObject } from 'marionette';

/**
 * Holds the current match for one outlet's subtree. `set(match)` triggers
 * `change` with `(routeState, match, previousMatch)` when the match object
 * changes.
 */
export class RouteState extends MnObject {
  #match;

  /** @param {import('../router.js').Match} match */
  constructor(match) {
    super();
    this.#match = match;
  }

  getMatch() {
    return this.#match;
  }

  getName() {
    return this.#match.name;
  }

  getParams() {
    return this.#match.params;
  }

  getQuery() {
    return this.#match.query;
  }

  getMeta() {
    return this.#match.meta;
  }

  getInfo() {
    return this.#match.info;
  }

  /** @param {string} name True when the match branch contains a node named `name`. */
  includes(name) {
    return this.#match.branch.some(node => node.name === name);
  }

  /** @param {import('../router.js').Match} match */
  set(match) {
    const previous = this.#match;
    if (this.isDestroyed() || match === previous) return;

    this.#match = match;
    this.triggerMethod('change', this, match, previous);
  }
}
