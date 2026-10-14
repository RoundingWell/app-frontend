// Optional latest-detail delivery over shared resource preparation. A navigation
// signal must not cancel the shared Application start for the same resource.
export function createRouteDelivery({ start, read, write, dispatch }) {
  let runId = 0;
  let intent;

  return {
    activated() {
      runId++;
    },
    invalidate() {
      intent = undefined;
    },
    async accept(route, options) {
      const previousRun = runId;
      const routeIntent = {};
      intent = routeIntent;
      write(route);
      if (intent !== routeIntent) return;
      const started = await start(options);
      if (!started || intent !== routeIntent) return;
      if (runId === previousRun) dispatch(read());
      return true;
    },
  };
}
