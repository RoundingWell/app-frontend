import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import RouteBaseApp from 'js/base/route-base-app';

import NavApp from 'js/apps/globals/nav/nav_app';
import WorkspaceApp from './workspace_app';

export default RouteBaseApp.extend({
  childApps: {
    nav: NavApp,
    workspace: WorkspaceApp,
  },
  initialize() {
    const navState = this.getChildApp('nav').getState();

    this.listenTo(navState, 'change:isMinimized', this.onChangeNavMinimized);
    this.listenTo(Radio.channel('workspace'), 'change:workspace', this.onChangeWorkspace);
  },
  onBeforeStart(app, options) {
    this.shellOptions = options;
    const navState = this.getChildApp('nav').getState();
    this.onChangeNavMinimized(navState, navState.get('isMinimized'));
  },
  onChangeNavMinimized(state, isMinimized) {
    this.shellOptions.setNavMinimized(isMinimized);
  },
  async prepareStart(options, { signal }) {
    await this.getChildApp('nav').start({ region: options.navRegion });
    signal.throwIfAborted();

    return this.startWorkspace(Radio.request('workspace', 'current'));
  },
  onChildCleanupError(error) {
    addError(error);
  },
  startWorkspace(workspace) {
    return this.selectChild('workspace', {
      start: app => app.start({ ...this.shellOptions, workspace }),
    });
  },
  onChangeWorkspace(workspace) {
    this.getChildApp('nav').refreshWorkspace();

    this.startWorkspace(workspace).catch(addError);
  },
});
