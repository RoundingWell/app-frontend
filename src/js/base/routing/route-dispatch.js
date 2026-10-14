// Route authority is independent of Application readiness and resource loading.
// The caller supplies any preparation, effects and error presentation explicitly.
export function createRouteDispatch({ prepare, dispatch, onError }) {
  let current;
  let disposed = false;

  function invalidate() {
    const previous = current;
    current = undefined;
    previous?.controller.abort();
  }

  return {
    invalidate,
    dispose() {
      disposed = true;
      invalidate();
    },
    accept(route) {
      if (disposed) return Promise.resolve();
      const previous = current;
      const controller = new AbortController();
      const intent = { controller };
      // Install the new identity before abort listeners can synchronously route.
      current = intent;
      const navigation = {
        route,
        signal: controller.signal,
        isCurrent: () => !disposed && current === intent,
      };
      previous?.controller.abort();

      return activate(navigation);
    },
  };

  async function activate(navigation) {
    try {
      if (!navigation.isCurrent()) return;
      if (prepare && !await prepare(navigation)) return;
      if (!navigation.isCurrent()) return;
      return await dispatch(navigation);
    } catch(error) {
      if (navigation.isCurrent()) return onError(error, navigation.route);
    }
  }
}
