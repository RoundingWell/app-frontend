import { isArray, map, reduce } from 'underscore';

// Pure definitions and generation. The host adapter owns matching and history.
export function translateRoute(route, args) {
  return reduce(args, (path, arg) => path.replace(/(\(\?)?:\w+/, () => arg), route);
}

export function createRouteTable(definitions = {}, { workspaceSlug } = {}) {
  function prefix(route, root) {
    if (root) return route;
    if (!workspaceSlug) throw new Error('Routing requires workspaceSlug for non-root routes');
    return route ? `${ workspaceSlug }/${ route }` : workspaceSlug;
  }

  const triggers = reduce(definitions, (routes, { route, root }, event) => {
    routes[event] = isArray(route) ? map(route, path => prefix(path, root)) : prefix(route, root);
    return routes;
  }, {});

  function canonical(event) {
    const routes = triggers[event];
    return isArray(routes) ? routes[0] : routes;
  }

  return {
    triggers,
    canonical,
    href(event, ...args) {
      return translateRoute(canonical(event), args);
    },
    context(event, eventArgs) {
      const definition = definitions[event];
      return {
        event,
        eventArgs,
        definition: {
          action: definition.action,
          route: isArray(definition.route) ? definition.route[0] : definition.route,
          root: definition.root,
          meta: definition.meta || {},
        },
      };
    },
  };
}
