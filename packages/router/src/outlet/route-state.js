import { MnObject } from 'marionette';

/**
 * Holds the current match for one outlet's subtree. `set(match)` triggers
 * `change` with `(routeState, match, previousMatch)` when the match object
 * changes.
 */
export class RouteState extends MnObject {
  /** @param {import('../router.js').Match} match */
  constructor(match) {
    throw new Error('Not implemented');
  }

  getMatch() {
    throw new Error('Not implemented');
  }

  getName() {
    throw new Error('Not implemented');
  }

  getParams() {
    throw new Error('Not implemented');
  }

  getQuery() {
    throw new Error('Not implemented');
  }

  getMeta() {
    throw new Error('Not implemented');
  }

  getInfo() {
    throw new Error('Not implemented');
  }

  /** @param {string} name True when the match branch contains a node named `name`. */
  includes(name) {
    throw new Error('Not implemented');
  }

  /** @param {import('../router.js').Match} match */
  set(match) {
    throw new Error('Not implemented');
  }
}
