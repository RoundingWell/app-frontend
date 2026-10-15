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

const BASE_URL = 'http://localhost';
const POLICIES = ['canonicalize', 'preserve'];
const MODIFIERS = '?*+';
const TEXT_STOPS = ':(*{}';
const NAME = /[A-Za-z_$][\w$]*/y;

const STATIC = 3;
const PARAM = 2;
const OPTIONAL = 1;
const WILDCARD = 0;

const ROOT = { path: '', names: [], meta: {}, branch: [] };

function normalizePath(path) {
  return `/${ path.replace(/^\/+|\/+$/g, '') }`;
}

function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

function joinPaths(parentPath, path) {
  return normalizePath(path.startsWith('/') ? path : `${ parentPath }/${ path }`);
}

function toURL(url) {
  return url instanceof URL ? url : new URL(url, BASE_URL);
}

function toSearchParams(query) {
  if (query === undefined || query === null) return new URLSearchParams();
  if (typeof query === 'string' || query instanceof URLSearchParams) return new URLSearchParams(query);
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);
  return new URLSearchParams(entries);
}

/* Path tokenizer: text | param | group, mirroring the URLPattern pathname syntax. */

function readModifier(state) {
  const char = state.path[state.pos];
  if (!char || !MODIFIERS.includes(char)) return '';
  state.pos++;
  return char;
}

function skipRegex(state) {
  let depth = 0;
  while (state.pos < state.path.length) {
    const char = state.path[state.pos++];
    if (char === '\\') state.pos++;
    else if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return;
  }
  throw new Error(`Unterminated "(" in path "${ state.path }"`);
}

function readRegex(state) {
  const start = state.pos + 1;
  skipRegex(state);
  return state.path.slice(start, state.pos - 1);
}

function paramToken(state, name, wildcard) {
  const regex = !wildcard && state.path[state.pos] === '(' ? readRegex(state) : undefined;
  return { type: 'param', name, prefix: '', wildcard, regex, modifier: readModifier(state) };
}

function readNamed(state) {
  state.pos++;
  NAME.lastIndex = state.pos;
  const match = NAME.exec(state.path);
  if (!match) throw new Error(`Expected a parameter name after ":" in path "${ state.path }"`);
  state.pos = NAME.lastIndex;
  return paramToken(state, match[0], false);
}

function readUnnamed(state) {
  return paramToken(state, String(state.unnamed++), false);
}

function readWildcard(state) {
  state.pos++;
  return paramToken(state, String(state.unnamed++), true);
}

function readGroup(state) {
  state.pos++;
  const tokens = readTokens(state, true);
  state.pos++;
  return { type: 'group', tokens, modifier: readModifier(state) };
}

function readText(state) {
  let value = '';
  while (state.pos < state.path.length && !TEXT_STOPS.includes(state.path[state.pos])) {
    if (state.path[state.pos] === '\\') state.pos++;
    value += state.path[state.pos++] ?? '';
  }
  return { type: 'text', value };
}

const READERS = { ':': readNamed, '(': readUnnamed, '*': readWildcard, '{': readGroup };

// A '/' directly before a param belongs to the param, so optional params drop it too.
function takePrefix(tokens, token) {
  const last = tokens.at(-1);
  if (last?.type !== 'text' || !last.value.endsWith('/')) return;
  last.value = last.value.slice(0, -1);
  token.prefix = '/';
  if (!last.value) tokens.pop();
}

function readTokens(state, inGroup) {
  const tokens = [];
  while (state.pos < state.path.length) {
    const char = state.path[state.pos];
    if (char === '}') {
      if (!inGroup) throw new Error(`Unexpected "}" in path "${ state.path }"`);
      return tokens;
    }
    const token = (READERS[char] ?? readText)(state);
    if (token.type === 'param') takePrefix(tokens, token);
    tokens.push(token);
  }
  if (inGroup) throw new Error(`Unterminated "{" in path "${ state.path }"`);
  return tokens;
}

function tokenize(path) {
  return readTokens({ path, pos: 0, unnamed: 0 }, false);
}

function paramNames(tokens) {
  return tokens.flatMap(token => {
    if (token.type === 'group') return paramNames(token.tokens);
    return token.type === 'param' ? [token.name] : [];
  });
}

function uniqueParamNames(tokens, label) {
  const names = paramNames(tokens);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate !== undefined) throw new Error(`Route ${ label } repeats param "${ duplicate }"; param names must be unique within a branch`);
  return names;
}

/* Ranking: one rank per path segment, compared left to right. */

function paramRank(token) {
  if (token.wildcard || token.modifier === '*' || token.modifier === '+') return WILDCARD;
  return token.modifier === '?' ? OPTIONAL : PARAM;
}

function groupCap(group, cap) {
  if (group.modifier === '?') return Math.min(cap, OPTIONAL);
  if (group.modifier === '*' || group.modifier === '+') return WILDCARD;
  return cap;
}

function closeSegment(state) {
  if (state.current !== null) state.ranks.push(state.current);
  state.current = null;
}

function addToSegment(state, rank) {
  state.current = Math.min(state.current ?? rank, rank);
}

function collectText(value, cap, state) {
  value.split('/').forEach((piece, index) => {
    if (index > 0) closeSegment(state);
    if (piece) addToSegment(state, Math.min(cap, STATIC));
  });
}

function collectRanks(tokens, cap, state) {
  for (const token of tokens) {
    if (token.type === 'text') {
      collectText(token.value, cap, state);
    } else if (token.type === 'group') {
      collectRanks(token.tokens, groupCap(token, cap), state);
    } else {
      if (token.prefix) closeSegment(state);
      addToSegment(state, Math.min(cap, paramRank(token)));
    }
  }
}

function segmentRanks(tokens) {
  const state = { ranks: [], current: null };
  collectRanks(tokens, STATIC, state);
  closeSegment(state);
  return state.ranks;
}

function compareRanks(a, b) {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index++) {
    if (a[index] !== b[index]) return b[index] - a[index];
  }
  return a.length - b.length;
}

function compareEntries(a, b) {
  return compareRanks(a.ranks, b.ranks) || a.mount - b.mount || a.seq - b.seq;
}

/* URL building */

function hasValue(params, name) {
  return params[name] !== undefined && params[name] !== null && params[name] !== '';
}

function isOptional(token) {
  return token.modifier === '?' || token.modifier === '*' || token.wildcard === true;
}

function isRepeated(token) {
  return token.wildcard || token.modifier === '*' || token.modifier === '+';
}

// A dot segment would be resolved away by URL parsing and name another route.
function encodeSegment(token, route, segment) {
  if (segment === '.' || segment === '..') {
    throw new Error(`Route "${ route.name }" param "${ token.name }" cannot contain the dot segment "${ segment }"`);
  }
  const encoded = encodeURIComponent(segment);
  if (token.regex !== undefined && !new RegExp(`^(?:${ token.regex })$`).test(encoded)) {
    throw new Error(`Route "${ route.name }" param "${ token.name }" must match (${ token.regex }): "${ segment }"`);
  }
  return encoded;
}

function encodeValue(token, route, value) {
  if (!isRepeated(token)) return encodeSegment(token, route, value);
  return value.split('/').map(segment => encodeSegment(token, route, segment)).join('/');
}

function buildParam(token, params, route) {
  if (!hasValue(params, token.name)) {
    if (isOptional(token)) return '';
    throw new Error(`Route "${ route.name }" is missing param "${ token.name }"`);
  }
  return token.prefix + encodeValue(token, route, String(params[token.name]));
}

function buildGroup(group, params, route) {
  const optional = group.modifier === '?' || group.modifier === '*';
  if (optional && !paramNames(group.tokens).some(name => hasValue(params, name))) return '';
  return buildTokens(group.tokens, params, route);
}

function buildTokens(tokens, params, route) {
  return tokens.map(token => {
    if (token.type === 'text') return token.value;
    if (token.type === 'group') return buildGroup(token, params, route);
    return buildParam(token, params, route);
  }).join('');
}

/* Compilation */

function assertDefinition(definition) {
  if (!definition || typeof definition.path !== 'string') {
    throw new TypeError('A route definition requires a string "path"');
  }
  if (definition.name === undefined && definition.aliases?.length) {
    throw new Error(`Aliases require a named route (path "${ definition.path }")`);
  }
}

function createPattern(path, name) {
  try {
    return new URLPattern({ pathname: path });
  } catch(error) {
    throw new Error(`Invalid path "${ path }" for route "${ name }": ${ error.message }`, { cause: error });
  }
}

function assertAliasParams(path, name, names, canonicalNames) {
  if (names.length === canonicalNames.length && names.every(item => canonicalNames.includes(item))) return;
  throw new Error(`Alias "${ path }" of route "${ name }" must declare exactly the params: ${ canonicalNames.join(', ') || '(none)' }`);
}

function compileAlias(alias, name, canonicalNames) {
  if (typeof alias?.path !== 'string' || !alias.path.startsWith('/')) {
    throw new Error(`Alias of route "${ name }" requires an absolute path starting with "/"`);
  }
  const policy = alias.policy ?? 'canonicalize';
  if (!POLICIES.includes(policy)) throw new Error(`Alias "${ alias.path }" of route "${ name }" has unknown policy "${ policy }"`);
  const path = normalizePath(alias.path);
  const tokens = tokenize(path);
  assertAliasParams(path, name, uniqueParamNames(tokens, `alias "${ path }"`), canonicalNames);
  return { path, until: alias.until, policy, tokens };
}

function addEntry(state, scope, route, alias, tokens) {
  const path = alias ? alias.path : route.path;
  state.entries.push({
    route,
    alias,
    pattern: createPattern(path, route.name),
    ranks: segmentRanks(tokens),
    mount: scope.index,
    seq: scope.seq++,
  });
}

function registerRoute(definition, node, tokens, state, scope) {
  const { name } = definition;
  if (typeof name !== 'string' || !name) throw new TypeError(`Route name must be a non-empty string (path "${ node.path }")`);
  if (state.byName.has(name)) throw new Error(`Duplicate route name "${ name }"`);
  const aliases = (definition.aliases ?? []).map(alias => compileAlias(alias, name, node.names));
  const route = { ...node, name, tokens, redirect: definition.redirect, aliases };
  state.byName.set(name, route);
  addEntry(state, scope, route, null, tokens);
  for (const alias of aliases) {
    addEntry(state, scope, route, alias, alias.tokens);
    state.aliases.push({ name, path: alias.path, until: alias.until, policy: alias.policy });
  }
}

function compileNode(definition, parent, state, scope) {
  assertDefinition(definition);
  const path = joinPaths(parent.path, definition.path);
  const tokens = tokenize(path);
  const names = uniqueParamNames(tokens, definition.name === undefined ? `"${ path }"` : `"${ definition.name }"`);
  const entry = {
    name: definition.name,
    path,
    names: names.filter(item => !parent.names.includes(item)),
    meta: { ...definition.meta },
  };
  const node = {
    path,
    names,
    meta: { ...parent.meta, ...definition.meta },
    branch: [...parent.branch, entry],
  };
  if (definition.name !== undefined) registerRoute(definition, node, tokens, state, scope);
  else state.prefixes.push({ names, depth: node.branch.length, pattern: createPattern(`${ path }{/*}?`, path) });
  for (const child of definition.children ?? []) compileNode(child, node, state, scope);
}

function compileMount(mount, state) {
  const parent = mount.parent === undefined ? ROOT : state.byName.get(mount.parent);
  const scope = { index: mount.index, seq: 0 };
  for (const definition of mount.routes) compileNode(definition, parent, state, scope);
}

// Mounts whose parent is not (or no longer) registered stay inactive until it returns.
function compile(mounts) {
  const state = { byName: new Map(), entries: [], aliases: [], prefixes: [] };
  let pending = mounts.map((mount, index) => ({ ...mount, index }));
  while (pending.length) {
    const ready = pending.filter(mount => mount.parent === undefined || state.byName.has(mount.parent));
    if (!ready.length) break;
    pending = pending.filter(mount => !ready.includes(mount));
    ready.forEach(mount => compileMount(mount, state));
  }
  state.entries.sort(compareEntries);
  return state;
}

/* Matching */

function decodeParams(names, groups) {
  const params = {};
  try {
    for (const name of names) {
      if (groups[name] !== undefined) params[name] = decodeURIComponent(groups[name]);
    }
  } catch(error) {
    if (error instanceof URIError) return null;
    throw error;
  }
  return params;
}

function pick(params, names) {
  return Object.fromEntries(names.filter(name => name in params).map(name => [name, params[name]]));
}

function toResult(entry, params, target) {
  const { route, alias } = entry;
  return {
    name: route.name,
    params,
    query: new URLSearchParams(target.search),
    url: target,
    meta: { ...route.meta },
    branch: route.branch.map(item => ({
      name: item.name,
      path: item.path,
      params: pick(params, item.names),
      meta: { ...item.meta },
    })),
    alias: alias ? alias.path : null,
    aliasPolicy: alias ? alias.policy : null,
    redirect: route.redirect,
  };
}

/**
 * Compiles a route tree and matches pathnames (URLPattern). Pure: no redirect,
 * driver, or event behavior. Ranking and encoding rules: DESIGN.md.
 */
export class Matcher {
  #mounts = [];
  #state = null;

  /** @param {RouteDefinition[]} [routes] */
  constructor(routes = []) {
    this.mount(routes);
  }

  #compiled() {
    this.#state ??= compile(this.#mounts);
    return this.#state;
  }

  #route(name) {
    const route = this.#compiled().byName.get(name);
    if (!route) throw new Error(`Unknown route "${ name }"`);
    return route;
  }

  /**
   * Matches `url.pathname` (trailing slash normalized except '/'). Strings are
   * resolved against 'http://localhost'. Returns null when nothing matches.
   * @param {URL | string} url
   * @returns {MatcherResult | null}
   */
  match(url) {
    const target = toURL(url);
    const pathname = normalizePathname(target.pathname);
    for (const entry of this.#compiled().entries) {
      const groups = entry.pattern.exec({ pathname })?.pathname.groups;
      if (!groups) continue;
      // A malformed percent-escape cannot be decoded, so the URL matches nothing.
      const params = decodeParams(entry.route.names, groups);
      return params && toResult(entry, params, target);
    }
    return null;
  }

  /**
   * Params of the deepest unnamed prefix node that contains `url.pathname`, for
   * URLs no route matches. Returns {} when no prefix node matches.
   * @param {URL | string} url
   * @returns {Record<string, string>}
   */
  matchPrefix(url) {
    const pathname = normalizePathname(toURL(url).pathname);
    const containing = this.#compiled().prefixes
      .filter(prefix => prefix.pattern.test({ pathname }))
      .sort((a, b) => b.depth - a.depth)[0];
    if (!containing) return {};
    return decodeParams(containing.names, containing.pattern.exec({ pathname }).pathname.groups) ?? {};
  }

  /**
   * Canonical path plus query as a string starting with '/'. Params are
   * encodeURIComponent-encoded. Throws for unknown names or missing params.
   * @param {string} name
   * @param {Record<string, string | number>} [params]
   * @param {{ query?: URLSearchParams | Record<string, string> | string }} [options]
   * @returns {string}
   */
  url(name, params = {}, options = {}) {
    const route = this.#route(name);
    const path = normalizePathname(buildTokens(route.tokens, params, route));
    const search = toSearchParams(options.query).toString();
    return search ? `${ path }?${ search }` : path;
  }

  /**
   * Param names of the canonical path in path order. Throws for unknown names.
   * @param {string} name
   * @returns {string[]}
   */
  getParamNames(name) {
    return [...this.#route(name).names];
  }

  /** @returns {{ name: string, path: string, until: string | undefined, policy: 'canonicalize' | 'preserve' }[]} */
  getAliases() {
    return this.#compiled().aliases.map(alias => ({ ...alias }));
  }

  /** @param {string} name */
  has(name) {
    return this.#compiled().byName.has(name);
  }

  /**
   * Adds routes, optionally under the named parent. Throws on duplicate names or
   * an unknown parent. Registration order never decides a match except as the
   * final ranking tie-break.
   * @param {RouteDefinition[]} routes
   * @param {{ parent?: string }} [options]
   * @returns {() => void} unmount; idempotent.
   */
  mount(routes, options = {}) {
    const { parent } = options;
    if (!Array.isArray(routes)) throw new TypeError('mount() requires an array of route definitions');
    if (parent !== undefined && !this.has(parent)) throw new Error(`Unknown parent route "${ parent }"`);
    const mount = { routes, parent };
    const previous = this.#state;
    this.#mounts.push(mount);
    this.#state = null;
    try {
      this.#compiled();
    } catch(error) {
      this.#mounts.pop();
      this.#state = previous;
      throw error;
    }
    return () => {
      const index = this.#mounts.indexOf(mount);
      if (index === -1) return;
      this.#mounts.splice(index, 1);
      this.#state = null;
    };
  }
}
