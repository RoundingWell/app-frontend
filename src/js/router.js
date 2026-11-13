import { map, without } from 'underscore';
import { Router } from '@mnjs/router';
import { Radio } from 'marionette';

import getNavigation from 'js/utils/get-navigation';

const driver = getNavigation() ?
  undefined :
  (await import('@mnjs/router/history')).historyDriver();

const defaultList = workspace => ({
  name: 'worklist',
  params: {
    workspace,
    worklistId: 'owned-by',
  },
  query: {},
  hash: '',
});
let workspaceSlugs;

// Transient reporting ownership for one fire-and-forget Radio navigation.
const eventNavigationReport = Symbol('event navigation report');

// The root and the user's workspaces. Anything else, such as paths the server
// owns, is neither intercepted nor claimed by not-found.
function isAppUrl(url) {
  const [, root] = url.pathname.split('/');

  if (!root || root === '404' || root === 'unknown-error') return true;

  // Workspaces are fixed for the session
  workspaceSlugs ||= new Set(Radio.request('bootstrap', 'workspaces').pluck('slug'));

  return workspaceSlugs.has(root);
}

const router = new Router({
  driver,
  routes: [
    {
      name: 'notFound',
      path: '/404',
    },
    {
      name: 'unknownError',
      path: '/unknown-error',
    },
    {
      name: 'root',
      path: '/',
      redirect: () => defaultList(Radio.request('workspace', 'current').get('slug')),
    },
    // The anonymous scope retains workspace params on unmatched descendants.
    // Feature registrations still mount beneath the named workspace route.
    {
      path: '/:workspace',
      children: [
        {
          name: 'workspace',
          path: '',
          redirect: ({ params }) => defaultList(params.workspace),
        },
      ],
    },
  ],
  owns: isAppUrl,
  notFound: 'notFound',
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
  eventNavigationReport,
  getPositionalParamNames,
  isAppUrl,
};
