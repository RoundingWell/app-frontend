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
  async prepareStart(options, { signal }) {
    await this.getChildApp('nav').start({ region: options.navRegion });
    signal.throwIfAborted();
    await this.getChildApp('workspaces').start();
    signal.throwIfAborted();
  },
  onStart() {
    router.start().then(() => this.showInitialUnmatched()).catch(addError);
  },
  async showInitialUnmatched() {
    const url = window.location.href;
    if (isAppUrl(new URL(url))) return;

    const workspace = Radio.request('workspace', 'current');
    const workspaceApp = await this.getChildApp('workspaces').switchTo('workspace', {
      key: { workspace: workspace.id },
      options: { ...this.shellOptions, workspace },
    });
    if (!workspaceApp || window.location.href !== url) return;
    Radio.request('error', 'show:notFound');
  },
  async showRoute(match, { signal }) {
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
