import { Pattern, normalizePathname, canonicalPathname, hasValue } from "./pattern.js";
import { toSearchParams } from "./query.js";
import { resolveMethod } from "@mnjs/utils";
const ROOT = { path: "", names: [], meta: {}, branch: [] };
function normalizePath(path) {
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}
function joinPaths(parentPath, path) {
  if (path.startsWith("/")) {
    return normalizePath(path);
  }
  const parent = parentPath === "/" ? "" : parentPath;
  return path.startsWith("{/") ? normalizePathname(`${parent}${path}`) : normalizePath(`${parent}/${path}`);
}
function compareRanks(a, b) {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index++) {
    if (a[index] !== b[index]) {
      return b[index] - a[index];
    }
  }
  return a.length - b.length;
}
function comparePriority(a, b) {
  return compareRanks(a.ranks, b.ranks) || a.mount - b.mount;
}
function assertDefinition(definition) {
  if (!definition || typeof definition.path !== "string") {
    throw new TypeError('A route definition requires a string "path"');
  }
}
function snapshotRoutes(routes, controller) {
  const array = Array.isArray(routes);
  const prototype = !array && routes && typeof routes === "object" ? Object.getPrototypeOf(routes) : void 0;
  if (!array && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("mount() requires an array of route definitions or a route hash");
  }
  const definitions = array ? routes : Object.entries(routes).map(([name, definition]) => ({ ...definition, name }));
  return definitions.map((definition) => {
    assertDefinition(definition);
    const handler = definition.handler === void 0 ? void 0 : resolveMethod(controller, definition.handler, definition.name ?? definition.path).bind(controller);
    return { ...definition, handler, meta: { ...definition.meta }, children: definition.children && snapshotRoutes(definition.children, controller) };
  });
}
function registerRoute(definition, node, pattern, state, mount) {
  const { name } = definition;
  if (typeof name !== "string" || !name) {
    throw new TypeError(`Route name must be a non-empty string (path "${node.path}")`);
  }
  if (state.byName.has(name)) {
    throw new Error(`Duplicate route name "${name}"`);
  }
  const route = { ...node, registration: definition, name, pattern, compiled: pattern.compile(name), ranks: pattern.getRanks(), mount, redirect: definition.redirect, handler: definition.handler };
  state.byName.set(name, route);
  state.routes.push(route);
}
function compileNode(definition, parent, state, mount) {
  const path = joinPaths(parent.path, definition.path);
  const pattern = new Pattern(path, definition.name === void 0 ? `"${path}"` : `"${definition.name}"`);
  const names = pattern.names;
  const ownNames = definition.path.startsWith("/") ? names : names.filter((item) => !parent.names.includes(item));
  const repeated = ownNames.find((name) => parent.branch.some((item) => item.names.includes(name)));
  if (repeated !== void 0) {
    throw new Error(`Route "${path}" repeats param "${repeated}"; param names must be unique within a branch`);
  }
  const entry = {
    name: definition.name,
    path,
    names: ownNames,
    meta: { ...definition.meta }
  };
  const node = {
    path,
    names,
    meta: { ...parent.meta, ...definition.meta },
    branch: [...parent.branch, entry]
  };
  if (definition.name !== void 0) {
    registerRoute(definition, node, pattern, state, mount);
  } else {
    state.prefixes.push({ depth: node.branch.length, compiled: pattern.compilePrefix(), ranks: pattern.getRanks(), mount });
  }
  for (const child of definition.children ?? []) {
    compileNode(child, node, state, mount);
  }
}
function compileMount(mount, state) {
  const parent = mount.parent === void 0 ? ROOT : state.byName.get(mount.parent);
  for (const definition of mount.routes) {
    compileNode(definition, parent, state, mount.index);
  }
}
function compile(mounts) {
  const state = { byName: /* @__PURE__ */ new Map(), routes: [], prefixes: [] };
  let pending = mounts.map((mount, index) => ({ ...mount, index }));
  while (pending.length) {
    const ready = pending.filter((mount) => mount.parent === void 0 || state.byName.has(mount.parent));
    if (!ready.length) {
      break;
    }
    pending = pending.filter((mount) => !ready.includes(mount));
    ready.forEach((mount) => compileMount(mount, state));
  }
  state.routes.sort(comparePriority);
  state.prefixes.sort((a, b) => b.depth - a.depth || comparePriority(a, b));
  return state;
}
function pick(params, names) {
  return Object.fromEntries(names.filter((name) => Object.hasOwn(params, name)).map((name) => [name, params[name]]));
}
function toResult(route, params, target) {
  return {
    registration: route.registration,
    name: route.name,
    params,
    query: new URLSearchParams(target.search),
    url: target,
    meta: { ...route.meta },
    branch: route.branch.map((item) => ({
      name: item.name,
      path: item.path,
      params: pick(params, item.names),
      meta: { ...item.meta }
    })),
    redirect: route.redirect,
    handler: route.handler
  };
}
class Matcher {
  #mounts = [];
  #state = null;
  #controller;
  constructor(routes = [], controller = {}) {
    this.#controller = controller;
    this.mount(routes);
  }
  #compiled() {
    this.#state ??= compile(this.#mounts);
    return this.#state;
  }
  #route(name) {
    const route = this.#compiled().byName.get(name);
    if (!route) {
      throw new Error(`Unknown route "${name}"`);
    }
    return route;
  }
  #select(pathname) {
    for (const route of this.#compiled().routes) {
      let params = route.compiled.exec(pathname);
      if (params === void 0 && pathname === "/") {
        params = route.compiled.exec("");
      }
      if (params === void 0) {
        continue;
      }
      return params && { route, params };
    }
    return null;
  }
  match(url) {
    const selected = this.#select(normalizePathname(url.pathname));
    return selected && toResult(selected.route, selected.params, url);
  }
  matchPrefix(url) {
    const pathname = normalizePathname(url.pathname);
    for (const prefix of this.#compiled().prefixes) {
      const params = prefix.compiled.exec(pathname);
      if (params !== void 0) {
        return params ?? {};
      }
    }
    return {};
  }
  url(name, params = {}, options = {}) {
    const route = this.#route(name);
    const path = canonicalPathname(route.pattern.build(params, route.name));
    const matched = this.#select(path);
    if (path.startsWith("//") || path.includes("\\") || matched?.route.name !== name || route.names.some((key) => hasValue(params, key) && matched.params[key] !== String(params[key]))) {
      throw new Error(`Route "${name}" params do not round trip through "${path}"`);
    }
    const search = toSearchParams(options.query).toString();
    return search ? `${path}?${search}` : path;
  }
  getParamNames(name) {
    return [...this.#route(name).names];
  }
  has(name) {
    return this.#compiled().byName.has(name);
  }
  hasRegistration(registration) {
    return this.#compiled().routes.some((route) => route.registration === registration);
  }
  mount(routes, options = {}) {
    const { parent, controller = this.#controller } = options;
    const registered = snapshotRoutes(routes, controller);
    if (parent !== void 0 && !this.has(parent)) {
      throw new Error(`Unknown parent route "${parent}"`);
    }
    const mount = { routes: registered, parent };
    const previous = this.#state;
    this.#mounts.push(mount);
    this.#state = null;
    try {
      this.#compiled();
    } catch (error) {
      this.#mounts.pop();
      this.#state = previous;
      throw error;
    }
    return () => {
      const index = this.#mounts.indexOf(mount);
      if (index === -1) {
        return;
      }
      this.#mounts.splice(index, 1);
      this.#state = null;
    };
  }
}
export {
  Matcher
};
