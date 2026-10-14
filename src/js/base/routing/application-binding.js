import { isEqual, isFunction } from 'underscore';

import { createChildSelection } from './child-selection.js';
import { createRouteDelivery } from './route-delivery.js';
import { createRouteActions } from './route-actions.js';

const bindings = new WeakMap();

// Optional Marionette binding. Installs once per instance, before or after its
// constructor hooks. Only public lifecycle methods/events are used. Policy is
// supplied explicitly; the Application need not implement router-specific hooks.
const defaults = {
  getScope: () => {
    throw new Error('A retained route destination requires getScope');
  },
  getActions: () => ({}),
  getChildOptions: options => options,
  beforeDispatch: () => {},
  afterDispatch: () => {},
  onStop: () => {},
  onDestroy: () => {},
  dispatchOnStart: true,
};

export function bindRouteApplication(application, configuration = {}) {
  const {
    getScope, getActions, getChildOptions, readRoute, writeRoute,
    beforeDispatch, afterDispatch, onError, onCleanupError,
    onStop, onDestroy, dispatchOnStart,
  } = {
    ...defaults,
    onError: (error, route) => application.triggerMethod('route:error', error, route),
    onCleanupError: (error, child) => application.triggerMethod('child:cleanup:error', error, child),
    ...configuration,
  };
  if (bindings.has(application)) throw new Error('Application already has a routing binding');
  let currentRoute;
  let dispatchedRoute;
  const read = readRoute || (() => currentRoute);
  const write = writeRoute || (route => {
    currentRoute = route;
  });
  const selection = createChildSelection({
    getChild: name => application.getChildApp(name),
    onCleanupError,
  });
  const actions = createRouteActions({
    getActions,
    before: beforeDispatch,
    after: afterDispatch,
    onError,
    isCurrent: route => read() === route,
  });
  const delivery = createRouteDelivery({
    start: options => application.start(options),
    read,
    write: setRoute,
    dispatch: dispatchCurrent,
  });

  function setRoute(route) {
    selection.invalidate();
    write(route);
  }

  function dispatchCurrent() {
    const route = read();
    dispatchedRoute = route;
    return actions(route);
  }

  function invalidate() {
    delivery.invalidate();
    selection.invalidate();
  }

  // Events alone miss stop() on an already-stopped owner. Capture each public
  // method once, preserving subclass behavior and synchronous return/throw rules.
  const stop = application.stop.bind(application);
  application.stop = (...args) => {
    invalidate();
    onStop();
    const stopped = stop(...args);
    if (stopped) selection.clear();
    return stopped;
  };
  const restart = application.restart.bind(application);
  application.restart = (...args) => {
    selection.invalidate();
    return restart(...args);
  };
  const destroy = application.destroy.bind(application);
  application.destroy = (...args) => {
    invalidate();
    onStop();
    const destroyed = destroy(...args);
    if (destroyed) selection.clear();
    return destroyed;
  };
  application.on('before:start', () => {
    selection.invalidate();
    dispatchedRoute = undefined;
  });
  application.on('start', () => {
    delivery.activated();
    // Owners can dispatch after shell construction but before showing it. The
    // default handles readiness automatically, without replaying a manual dispatch.
    if (dispatchOnStart && dispatchedRoute !== read()) dispatchCurrent();
  });
  application.on('before:stop', invalidate);
  application.on('before:destroy', onDestroy);

  const binding = {
    getScope,
    getRoute: read,
    setRoute,
    dispatchCurrent,
    invalidate,
    getChildOptions,
    getCurrent: selection.getCurrent,
    getSelection: selection.getSelection,
    select: selection.select,
    stopCurrent: selection.stop,
    async accept(route, options) {
      if (application.isDestroyed()) return;
      const started = await delivery.accept(route, options);
      if (started) return application;
    },
    startCurrent(name, options) {
      const route = read();
      return selection.select(name, {
        start: app => {
          setChildRoute(app, route);
          return app.start(getChildOptions(options));
        },
      });
    },
    startRoute(name, options) {
      const child = application.getChildApp(name);
      const scope = child && getChildScope(child, options);
      const selected = selection.getSelection();
      return selection.select(name, {
        scope,
        reuse: selected?.appName === name && isEqual(scope, selected.scope),
        start: app => acceptChildRoute(app, read(), getChildOptions(options)),
      });
    },
  };
  bindings.set(application, binding);
  return binding;
}

function setChildRoute(child, route) {
  const binding = bindings.get(child);
  if (binding) return binding.setRoute(route);
  if (isFunction(child.setCurrentRoute)) child.setCurrentRoute(route);
}

function getChildScope(child, options) {
  const binding = bindings.get(child);
  if (binding) return binding.getScope(options);
  if (isFunction(child.getRouteScope)) return child.getRouteScope(options);
}

function acceptChildRoute(child, route, options) {
  const binding = bindings.get(child);
  if (binding) return binding.accept(route, options);
  return child.startRoute(route, options);
}
