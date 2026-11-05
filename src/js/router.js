import { map, without } from 'underscore';
import { Router } from '@mnjs/router';
import { Radio } from 'marionette';

import getRoutes from 'js/routes';

let handler;
let workspaceSlugs;

// The root and the user's workspaces. Anything else, such as paths the server
// owns, is neither intercepted nor claimed by not-found.
function isAppUrl(url) {
  const [, root] = url.pathname.split('/');

  if (!root || root === '404' || root === 'unknown-error') return true;

  // Workspaces are fixed for the session
  workspaceSlugs ||= new Set(Radio.request('bootstrap', 'workspaces').pluck('slug'));

  return workspaceSlugs.has(root);
}

// The owner of activation: one handler, set by the app frame.
function setRouteHandler(routeHandler) {
  handler = routeHandler;
}

const router = new Router({
  routes() {
    return getRoutes(this);
  },
  intercept: isAppUrl,
  notFound: { name: 'notFound', within: isAppUrl },
  persistParams: ['workspace'],
  handler: (match, context) => handler(match, context),
});

// Match the other runtime exports exposed for console navigation/debugging.
window.router = router;

// The params callers pass by position. The current workspace fills `workspace`
// unless it is the route's only param.
function getPositionalParamNames(name) {
  if (name === 'workspace') return ['workspace'];

  return without(router.getParamNames(name), 'workspace');
}

export function getPositionalArgs(match) {
  return map(getPositionalParamNames(match.name), name => match.params[name]);
}

export default router;

export {
  getPositionalParamNames,
  isAppUrl,
  setRouteHandler,
};
