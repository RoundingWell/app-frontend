import { bindRouteApplication } from './application-binding.js';
import { createRouteTable } from './route-table.js';
import { createRouteDispatch } from './route-dispatch.js';

// Optional area binding. The supplied transport owns matching/subscription and
// silent writes; this module has no Backbone, Radio or browser-global dependency.
export function bindApplicationRouter(application, {
  definitions,
  workspaceSlug,
  transport,
  region,
  resolveAction,
  beforeDispatch = () => {},
  afterDispatch = () => {},
  onError = (error, route) => application.triggerMethod('route:error', error, route),
  onCleanupError = (error, child) => application.triggerMethod('child:cleanup:error', error, child),
  startOnRoute = true,
  onNoMatch,
}) {
  const table = createRouteTable(definitions, { workspaceSlug });
  const dispatch = createRouteDispatch({
    prepare: () => {
      if (!startOnRoute) return true;
      const destination = region || application.getRegion();
      return application.start(destination ? { region: destination } : undefined);
    },
    dispatch: ({ route }) => {
      beforeDispatch(route);
      const activation = resolveAction(route.definition.action)(...route.eventArgs);
      afterDispatch(route);
      return activation;
    },
    onError,
  });
  const binding = bindRouteApplication(application, {
    dispatchOnStart: false,
    getChildOptions: options => ({ ...options, region: application.getRegion() }),
    onCleanupError,
    onError,
    onStop: dispatch.invalidate,
    onDestroy: () => {
      dispatch.dispose();
      connection.dispose();
    },
  });

  function accept(route) {
    if (application.isDestroyed()) return Promise.resolve();
    binding.setRoute(route);
    return dispatch.accept(route);
  }

  function leave() {
    const route = binding.getRoute();
    binding.setRoute(null);
    dispatch.invalidate();
    try {
      application.stop();
    } catch(error) {
      onError(error, route);
    }
  }

  const connection = transport.connect(table, {
    onRoute: accept,
    onNoMatch: onNoMatch || leave,
  });

  return {
    ...binding,
    table,
    connection,
    accept,
    leave,
    href: table.href,
    write: transport.write,
    replaceRoute(event, ...args) {
      transport.write(table.href(event, ...args), { replace: true });
    },
    navigateRoute(event, ...args) {
      transport.write(table.href(event, ...args));
    },
  };
}
