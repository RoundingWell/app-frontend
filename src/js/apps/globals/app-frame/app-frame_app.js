import { Radio } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

import { addError } from 'js/datadog';

import App from 'js/base/app';
import router, { isAppUrl, setRouteHandler } from 'js/router';

import NavApp from 'js/apps/globals/nav/nav_app';
import WorkspaceApp from './workspace_app';

const Workspaces = ChildAppSwitcher.extend({
  childApps: { workspace: WorkspaceApp },
  onCleanupError: addError,
});

export default App.extend({
  childApps: { nav: NavApp, workspaces: Workspaces },
  initialize() {
    this.addChildApp('router', router);
    const navState = this.getChildApp('nav').getState();
    this.listenTo(navState, 'change:isMinimized', this.onChangeNavMinimized);
    this.listenTo(router, 'route:error', this.onRouteError);
  },
  onBeforeStart(app, options) {
    this.shellOptions = options;
    const navState = this.getChildApp('nav').getState();
    this.onChangeNavMinimized(navState, navState.get('isMinimized'));
    setRouteHandler((match, context) => this.showRoute(match, context));
  },
  onChangeNavMinimized(state, isMinimized) {
    this.shellOptions.setNavMinimized(isMinimized);
  },
  onRouteError(error) {
    // The entrypoint owns initial workspace failures, including permission/setup
    // recovery. Only that exact shared failure is already being handled there.
    if (this.workspaceStartupFailure && this.workspaceStartupFailure.error === error) return;
    window.reportError(error);
  },
  async prepareStart(options, { signal }) {
    this.workspaceStartupFailure = null;
    await this.getChildApp('nav').start({ region: options.navRegion });
    signal.throwIfAborted();
    const workspaces = this.getChildApp('workspaces');
    await workspaces.start();
    signal.throwIfAborted();

    // Workspace prerequisites must load even while an initial legacy redirect
    // waits for its resource. Enable error routing before awaiting those loads.
    const workspace = Radio.request('workspace', 'current');
    const initialWorkspace = workspaces.switchTo('workspace', {
      key: { workspace: workspace.id },
      options: { ...this.shellOptions, workspace },
    });
    // Selection authority may move to the router's same-key request. Required
    // workspace readiness still belongs to startup and must propagate failures.
    initialWorkspace.catch(() => {});
    const workspaceReady = workspaces.getChildApp('workspace').start().catch(error => {
      this.workspaceStartupFailure = { error };
      throw error;
    });
    await router.start();
    signal.throwIfAborted();
    await workspaceReady;
    signal.throwIfAborted();
    await initialWorkspace;
    signal.throwIfAborted();
  },
  onStart() {
    // Workspace prerequisites are ready even when the engine leaves an initial
    // server-owned or unknown-root URL unmatched.
    if (!isAppUrl(new URL(window.location.href))) Radio.request('error', 'show:notFound');
  },
  async showRoute(match, { signal }) {
    // Error UI is owned by ErrorApp and must remain usable when workspace
    // prerequisites themselves failed. Avoid reloading those prerequisites here.
    if (match.name === 'notFound' || match.name === 'unknownError') {
      this.getChildApp('workspaces').getCurrent()?.stopArea();
      return;
    }
    const previous = Radio.request('workspace', 'current');
    const workspace = Radio.request('workspace', 'current', match.params.workspace);
    if (previous !== workspace) this.getChildApp('nav').refreshWorkspace();

    const workspaceApp = await this.getChildApp('workspaces').switchTo('workspace', {
      key: { workspace: workspace.id },
      options: { ...this.shellOptions, workspace },
      signal,
    });
    if (!workspaceApp || signal.aborted) return;
    return workspaceApp.showRoute(match);
  },
});
