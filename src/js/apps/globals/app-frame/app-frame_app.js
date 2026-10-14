import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

import { addError } from 'js/datadog';

import handleErrors from 'js/utils/handle-errors';

import App from 'js/base/app';

import router, { isAppUrl, setRouteHandler } from 'js/router';

import NavApp from 'js/apps/globals/nav/nav_app';
import WorkspaceApp from './workspace_app';

export default App.extend({
  childApps: {
    nav: NavApp,
    workspace: WorkspaceApp,
  },
  initialize() {
    const navState = this.getChildApp('nav').getState();

    this.workspaces = new RouteOutlet({ owner: this, onCleanupError: addError });

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
  },
  // The shell is usable while the first page loads
  onStart() {
    router.start().catch(error => handleErrors(error).catch(reportedError => window.reportError(reportedError)));

    // The server owns URLs outside the root and the user's workspaces
    if (!isAppUrl(new URL(window.location.href))) Radio.trigger('event-router', 'notFound');
  },
  // The router waits for the whole chain: workspace, area, then the area's page
  async showRoute(match, { signal }) {
    const workspace = Radio.request('workspace', 'current');

    const workspaceApp = await this.workspaces.show('workspace', {
      key: { workspace: workspace.id },
      match,
      options: { ...this.shellOptions, workspace },
    });

    signal.throwIfAborted();

    return workspaceApp.showRoute(match);
  },
});
