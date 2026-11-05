import { Application } from "marionette";
import { equalKeys, snapshotKey } from "./selection-key.js";
const states = /* @__PURE__ */ new WeakMap();
const stateFor = (switcher) => states.get(switcher);
function currentSelection(switcher) {
  const state = stateFor(switcher);
  const selection = state.selection;
  if (selection && switcher.getChildApp(selection.appName) !== selection.app) {
    state.selection = null;
  }
  return state.selection;
}
function canSelect(switcher) {
  return switcher.isRunning() && !stateFor(switcher).stopping;
}
function stopSelection(switcher) {
  const state = stateFor(switcher);
  const selection = currentSelection(switcher);
  if (!selection) {
    return;
  }
  const intent = state.intent;
  selection.app.stop();
  if (state.intent === intent && state.selection === selection) {
    state.selection = null;
  }
}
function cleanup(switcher, selection) {
  try {
    stopSelection(switcher);
  } catch (error) {
    const report = switcher.getOption("onCleanupError");
    report?.call(switcher, error, selection.app);
  }
}
async function activate(switcher, intent, selection, options) {
  const state = stateFor(switcher);
  const { app } = selection;
  try {
    const started = await app.start(options);
    if (state.intent !== intent || currentSelection(switcher) !== selection) {
      return;
    }
    if (started) {
      return app;
    }
  } catch (error) {
    if (state.intent !== intent || currentSelection(switcher) !== selection) {
      return;
    }
    cleanup(switcher, selection);
    throw error;
  }
}
async function select(switcher, intent, app, appName, { key, reconstruct = false, options }) {
  const state = stateFor(switcher);
  const current = currentSelection(switcher);
  if (!reconstruct && current?.app === app && equalKeys(current.key, key)) {
    return activate(switcher, intent, current, options);
  }
  stopSelection(switcher);
  if (state.intent !== intent) {
    return;
  }
  const selected = { app, appName, key };
  state.selection = selected;
  return activate(switcher, intent, selected, options);
}
function constructSwitcher(options = {}) {
  const state = {
    selection: null,
    intent: null,
    stopping: false
  };
  states.set(this, state);
  const invalidate = () => {
    state.stopping = true;
    state.intent = null;
    state.selection = null;
  };
  this.on({
    "before:stop": invalidate,
    "stop": () => {
      state.stopping = false;
    },
    "before:destroy": invalidate
  });
  Application.call(this, options);
}
const ChildAppSwitcher = Application.extend({
  constructor: constructSwitcher,
  async switchTo(appName, selection = {}) {
    const state = stateFor(this);
    if (!canSelect(this) || selection.signal?.aborted) {
      return;
    }
    const app = this.getChildApp(appName);
    if (!app) {
      throw new Error(`Child application "${appName}" is not registered`);
    }
    const key = snapshotKey(selection.key);
    const intent = {};
    state.intent = intent;
    try {
      const selected = await select(this, intent, app, appName, { ...selection, key });
      if (state.intent !== intent || !canSelect(this) || selection.signal?.aborted || currentSelection(this)?.app !== selected || this.getChildApp(appName) !== selected || !selected?.isRunning()) {
        return;
      }
      return selected;
    } catch (error) {
      if (state.intent !== intent || selection.signal?.aborted) {
        return;
      }
      throw error;
    }
  },
  clear() {
    if (!canSelect(this)) {
      return true;
    }
    stateFor(this).intent = null;
    stopSelection(this);
    return true;
  },
  getCurrent() {
    return currentSelection(this)?.app ?? null;
  }
});
export {
  ChildAppSwitcher
};
