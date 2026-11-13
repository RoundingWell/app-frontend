import { Radio } from 'marionette';
import App from 'js/base/app';
import RouteApp from 'js/base/route-app';
import router, { eventNavigationReport, getPositionalArgs, isAppUrl } from 'js/router';

import NavApp from 'js/apps/globals/nav/nav_app';
import WorkspaceApp from './workspace_app';
import { areaRoutes, loadAreas } from './areas';

const Workspaces = RouteApp.extend({
  childApps: {
    workspace: WorkspaceApp,
  },
});

export default App.extend({
  childApps: {
    nav: NavApp,
    workspaces: Workspaces,
  },
  initialize() {
    this.listenTo(router, 'route', this.onRoute);
    const navState = this.getChildApp('nav').getState();
    this.listenTo(navState, 'change:isMinimized', this.onChangeNavMinimized);
    this.listenTo(router, 'route:error', this.onRouteError);
    this.addChildApp('router', router);
  },
  onBeforeStart(app, options) {
    this.shellOptions = options;
    const navState = this.getChildApp('nav').getState();
    this.onChangeNavMinimized(navState, navState.get('isMinimized'));
  },
  onChangeNavMinimized(state, isMinimized) {
    this.shellOptions.setNavMinimized(isMinimized);
  },
  onRouteError(error, match, { info }) {
    // Root startup owns its exact shared workspace failure. Every other route
    // failure keeps the browser reporting path, including pre-Match failures.
    const rootOwnsFailure = this.workspaceStartupFailure && Object.is(this.workspaceStartupFailure.error, error);
    if (!rootOwnsFailure) window.reportError(error);
    const report = info?.[eventNavigationReport];
    if (report) {
      report.handled = {
        error,
      };
    }
  },
  async prepareStart(options, { signal }) {
    this.workspaceStartupFailure = null;
    await this.getChildApp('nav').start({
      region: options.navRegion,
    });
    signal.throwIfAborted();
    const workspaces = this.getChildApp('workspaces');
    await workspaces.start();
    signal.throwIfAborted();

    this.areaTypes ||= await loadAreas();
    signal.throwIfAborted();
    this.unmountAreas ||= router.mount(areaRoutes(this.areaTypes), {
      parent: 'workspace',
      controller: this,
      owner: this,
    });

    // Workspace prerequisites must load even while an initial legacy redirect
    // waits for its resource. Enable error routing before awaiting those loads.
    const workspace = Radio.request('workspace', 'current');
    const initialWorkspace = workspaces.switchTo('workspace', {
      key: {
        workspace: workspace.id,
      },
      options: {
        ...this.shellOptions,
        workspace,
        areaTypes: this.areaTypes,
      },
    }).catch(error => {
      this.workspaceStartupFailure = {
        error,
      };
      throw error;
    });
    await Promise.all([initialWorkspace, router.start()]);
    signal.throwIfAborted();
  },
  onStart() {
    // Workspace prerequisites are ready even when the engine leaves an initial
    // server-owned or unknown-root URL unmatched.
    if (!isAppUrl(new URL(window.location.href))) Radio.request('error', 'show:notFound');
  },
  onRoute(match) {
    // Error UI is owned by ErrorApp and must remain usable when workspace
    // prerequisites themselves failed. Avoid reloading those prerequisites here.
    if (match.name === 'notFound' || match.name === 'unknownError') {
      this.getChildApp('workspaces').getCurrent()?.clearRoute();
    }
  },
  async routeTo(match) {
    const previous = Radio.request('workspace', 'current');
    const workspace = Radio.request('workspace', 'current', match.params.workspace);
    if (previous !== workspace) this.getChildApp('nav').refreshWorkspace();

    const workspaceApp = await this.getChildApp('workspaces').switchTo('workspace', {
      key: {
        workspace: workspace.id,
      },
      signal: match.signal,
      options: {
        ...this.shellOptions,
        workspace,
        areaTypes: this.areaTypes,
      },
    });
    if (!workspaceApp || match.signal.aborted) return;
    if (match.meta.clearArea) return workspaceApp.clearRoute();

    Radio.request('nav', 'select', match.meta.nav, match.name, getPositionalArgs(match));
    Radio.request('sidebar', 'stop');
    workspaceApp.registerArea(match.meta.area);
    return workspaceApp.routeTo(match);
  },
});
