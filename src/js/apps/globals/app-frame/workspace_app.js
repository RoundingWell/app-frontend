import { each } from 'underscore';
import { Radio } from 'marionette';

import RouteApp from 'js/base/route-app';

import SidebarService from 'js/services/sidebar';

export default RouteApp.extend({
  childApps: {
    sidebar: SidebarService,
  },
  onBeforeStart(app, options) {
    this.shellOptions = options;
  },
  async prepareStart(options, { signal }) {
    // These apps capture workspace-specific stores and filters at construction.
    each(this.areaTypes, (AreaApp, name) => this.removeChildApp(name));
    await Radio.request('workspace', 'fetch', {
      workspace: options.workspace,
      signal,
    });
    signal.throwIfAborted();
    await this.getChildApp('sidebar').start({
      region: options.sidebarRegion,
    });
    signal.throwIfAborted();
    return options.areaTypes;
  },
  onStart(app, options, areaTypes) {
    this.areaTypes = areaTypes;
  },
  getMountRegion() {
    return this.shellOptions.contentRegion;
  },
  clearRoute() {
    Radio.request('sidebar', 'stop');
    this.clear();
  },
  registerArea(name) {
    const AreaApp = this.areaTypes[name];
    if (!this.hasChildApp(name)) this.addChildApp(name, new AreaApp());
  },
});
