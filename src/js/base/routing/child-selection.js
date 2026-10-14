// Optional single-destination policy. No URL, Region or resource identity policy.
export function createChildSelection({ getChild, onCleanupError }) {
  let selected = null;
  let intent = null;

  function invalidate() {
    intent = null;
  }

  function stopSelected() {
    const previous = selected;
    if (!previous) return true;
    previous.app.stop();
    if (selected === previous) selected = null;
    return true;
  }

  function cleanup(app) {
    try {
      stopSelected();
    } catch(error) {
      onCleanupError(error, app);
    }
  }

  async function activate(selection, selectionIntent, start) {
    const { app } = selection;
    try {
      const started = await start(app);
      if (intent !== selectionIntent) return;
      if (!started) {
        if (!app.isRunning()) cleanup(app);
        return;
      }
      return app;
    } catch(error) {
      if (intent !== selectionIntent) return;
      cleanup(app);
      throw error;
    }
  }

  return {
    invalidate,
    getCurrent: () => selected?.app || null,
    getSelection: () => selected,
    clear() {
      if (!intent) selected = null;
    },
    stop() {
      invalidate();
      return stopSelected();
    },
    async select(appName, { scope, reuse = false, start }) {
      const app = getChild(appName);
      if (!app) throw new Error(`Child application "${ appName }" is not registered`);
      const selectionIntent = {};
      intent = selectionIntent;
      if (!reuse) {
        stopSelected();
        if (intent !== selectionIntent) return;
      }
      const selection = { app, appName, scope };
      selected = selection;
      return activate(selection, selectionIntent, start);
    },
  };
}
