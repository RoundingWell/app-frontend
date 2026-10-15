import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import SidebarService from 'js/services/sidebar';

const AREAS = {
  patients: {
    load: () => import('js/apps/patients/patients-main_app'),
  },
  dashboards: {
    permission: 'dashboards:view',
    load: () => import('js/apps/dashboards/dashboards-main_app'),
  },
  clinicians: {
    permission: 'clinicians:manage',
    load: () => import('js/apps/clinicians/clinicians-main_app'),
  },
  programs: {
    permission: 'programs:manage',
    load: () => import('js/apps/programs/programs-main_app'),
  },
};

export default App.extend({
  childApps: {
    sidebar: SidebarService,
  },
  initialize() {
    this.areas = new RouteOutlet({ owner: this, onCleanupError: addError });

    // An error replaces the area content
    this.listenTo(Radio.channel('event-router'), {
      notFound: this.stopArea,
      unknownError: this.stopArea,
    });
  },
  onBeforeStart(app, options) {
    this.shellOptions = options;
  },
  async prepareStart(options, { signal }) {
    await Radio.request('workspace', 'fetch', { workspace: options.workspace, signal });

    signal.throwIfAborted();

    await this.getChildApp('sidebar').start({ region: options.sidebarRegion });
  },
  stopArea() {
    this.areas.stop();
  },
  canUseArea(name) {
    const { permission } = AREAS[name];

    return !permission || Radio.request('bootstrap', 'currentUser').can(permission);
  },
  // An area loads the first time a route needs it
  async loadArea(name) {
    const { default: AreaApp } = await AREAS[name].load();

    if (!this.hasChildApp(name)) this.addChildApp(name, new AreaApp());
  },
  // Shows the area that owns the match. Matches without an area (unmatched path,
  // failed redirect) leave no area content; an area the user may not use is not found.
  async showRoute(match) {
    const { area } = match.meta;

    if (!area) {
      this.stopArea();
      return;
    }

    if (!this.canUseArea(area)) {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    await this.loadArea(area);

    if (match.signal.aborted) return;

    await this.areas.show(area, {
      match,
      options: { region: this.shellOptions.contentRegion },
    });

    return this.getChildApp(area).showRoute(match);
  },
});
