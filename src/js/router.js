import { without } from 'underscore';
import { Router } from '@mnjs/router';
import { Radio } from 'marionette';

import routes from 'js/routes';

let handler;

// The root and the user's workspaces. Anything else, such as paths the server
// owns, is neither intercepted nor claimed by not-found.
function isAppUrl(url) {
  const [, root] = url.pathname.split('/');

  if (!root) return true;

  return !!Radio.request('bootstrap', 'workspaces').find({ slug: root });
}

// The owner of activation: one handler, set by the app frame.
function setRouteHandler(routeHandler) {
  handler = routeHandler;
}

const router = new Router({
  routes,
  intercept: isAppUrl,
  notFound: { name: 'notFound', within: isAppUrl },
  persistParams: ['workspace'],
  handler: (match, context) => handler(match, context),
});

// The params callers pass by position. The current workspace fills `workspace`
// unless it is the route's only param.
function getPositionalParamNames(name) {
  if (name === 'workspace') return ['workspace'];

  return without(router.getParamNames(name), 'workspace');
}

export default router;

export {
  getPositionalParamNames,
  isAppUrl,
  setRouteHandler,
};
