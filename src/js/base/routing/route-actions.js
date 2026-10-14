// Synchronous notifications describe dispatch, not asynchronous page readiness.
// getActions supplies already-bound functions; no Application shape is required.
export function createRouteActions({ getActions, before, after, onError, isCurrent }) {
  return function dispatch(route) {
    if (!route) return;
    before(route);
    const action = getActions()[route.event];
    if (!action) return;
    let activation;
    try {
      activation = action(...route.eventArgs);
    } catch(error) {
      activation = Promise.reject(error);
    }
    const completion = Promise.resolve(activation).catch(error => {
      if (isCurrent(route)) return onError(error, route);
    });
    after(route);
    return completion;
  };
}
