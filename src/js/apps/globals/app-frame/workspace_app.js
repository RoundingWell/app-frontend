import { each, map } from 'underscore';
import { Radio } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

import { addError } from 'js/datadog';

import App from 'js/base/app';
import { getPositionalArgs } from 'js/router';

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
    areas: ChildAppSwitcher.extend({ onCleanupError: addError }),
  },
  initialize() {
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
    // Area state captures workspace-specific stores and filters at construction.
    // Preserve that lifetime boundary while reusing the persistent nav shell.
    const areas = this.getChildApp('areas');
    each(areas.getChildApps(), (area, name) => areas.removeChildApp(name));

    // Preserve the existing shared/domain stylesheet load order while the app
    // proves route ownership independently of area code splitting.
    await Promise.all([
      Radio.request('workspace', 'fetch', { workspace: options.workspace, signal }),
      ...map(AREAS, ({ load }, name) => this.canUseArea(name) ? load() : null),
    ]);

    signal.throwIfAborted();

    await this.getChildApp('sidebar').start({ region: options.sidebarRegion });
    signal.throwIfAborted();
    await this.getChildApp('areas').start();
    signal.throwIfAborted();
  },
  stopArea() {
    this.getChildApp('areas').clear();
  },
  canUseArea(name) {
    const { permission } = AREAS[name];

    return !permission || Radio.request('bootstrap', 'currentUser').can(permission);
  },
  // Register each preloaded area the first time a route selects it
  async loadArea(name) {
    const { default: AreaApp } = await AREAS[name].load();

    const areas = this.getChildApp('areas');
    if (!areas.hasChildApp(name)) areas.addChildApp(name, new AreaApp());
  },
  // Shows the area that owns the match. Matches without an area (unmatched path,
  // failed redirect) leave no area content; an area the user may not use is not found.
  async showRoute(match) {
    const { area } = match.meta;
    const appNames = { patients: 'PatientsApp', dashboards: 'DashboardsApp', programs: 'ProgramsApp', clinicians: 'CliniciansApp' };
    if (area) Radio.request('nav', 'select', appNames[area], match.name, getPositionalArgs(match));
    Radio.request('sidebar', 'stop');

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

    const areaApp = await this.getChildApp('areas').switchTo(area, {
      options: { region: this.shellOptions.contentRegion },
      signal: match.signal,
    });
    if (!areaApp || match.signal.aborted) return;
    return areaApp.showRoute(match);
  },
});
