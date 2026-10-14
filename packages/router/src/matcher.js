/**
 * @typedef {object} AliasDefinition
 * @property {string} path Full path from the router base; declares exactly the canonical route's param names.
 * @property {string} [until] ISO date ending the compatibility window.
 * @property {'canonicalize' | 'preserve'} [policy] Default 'canonicalize'.
 */

/**
 * @typedef {object} RouteDefinition
 * @property {string} [name] Unique. Named nodes match their own full path; unnamed nodes are prefixes only.
 * @property {string} path URLPattern pathname syntax; relative to the parent unless it starts with '/'.
 * @property {RouteDefinition[]} [children]
 * @property {object} [meta] Shallow-merged root → leaf (child keys win).
 * @property {AliasDefinition[]} [aliases]
 * @property {(match: object, context: { signal: AbortSignal }) => any} [redirect] Passed through untouched.
 */

/**
 * @typedef {object} BranchEntry
 * @property {string | undefined} name
 * @property {string} path
 * @property {Record<string, string>} params Params first declared by this node.
 * @property {object} meta Own meta only.
 */

/**
 * @typedef {object} MatcherResult
 * @property {string} name Canonical name, also when an alias matched.
 * @property {Record<string, string>} params Decoded.
 * @property {URLSearchParams} query
 * @property {URL} url The input URL.
 * @property {object} meta Merged root → leaf.
 * @property {BranchEntry[]} branch Root → leaf.
 * @property {string | null} alias Matched alias path, or null.
 * @property {'canonicalize' | 'preserve' | null} aliasPolicy
 * @property {Function | undefined} redirect The matched node's `redirect`.
 */

/**
 * Compiles a route tree and matches pathnames (URLPattern). Pure: no redirect,
 * driver, or event behavior. Ranking and encoding rules: DESIGN.md.
 */
export class Matcher {
  /** @param {RouteDefinition[]} [routes] */
  constructor(routes = []) {
    throw new Error('Not implemented');
  }

  /**
   * Matches `url.pathname` (trailing slash normalized except '/'). Strings are
   * resolved against 'http://localhost'. Returns null when nothing matches.
   * @param {URL | string} url
   * @returns {MatcherResult | null}
   */
  match(url) {
    throw new Error('Not implemented');
  }

  /**
   * Canonical path plus query as a string starting with '/'. Params are
   * encodeURIComponent-encoded. Throws for unknown names or missing params.
   * @param {string} name
   * @param {Record<string, string | number>} [params]
   * @param {{ query?: URLSearchParams | Record<string, string> | string }} [options]
   * @returns {string}
   */
  url(name, params, options) {
    throw new Error('Not implemented');
  }

  /**
   * Param names of the canonical path in path order. Throws for unknown names.
   * @param {string} name
   * @returns {string[]}
   */
  getParamNames(name) {
    throw new Error('Not implemented');
  }

  /** @returns {{ name: string, path: string, until: string | undefined, policy: 'canonicalize' | 'preserve' }[]} */
  getAliases() {
    throw new Error('Not implemented');
  }

  /** @param {string} name */
  has(name) {
    throw new Error('Not implemented');
  }

  /**
   * Adds routes, optionally under the named parent. Throws on duplicate names or
   * an unknown parent. Registration order never decides a match except as the
   * final ranking tie-break.
   * @param {RouteDefinition[]} routes
   * @param {{ parent?: string }} [options]
   * @returns {() => void} unmount; idempotent.
   */
  mount(routes, options) {
    throw new Error('Not implemented');
  }
}
