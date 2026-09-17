import { some } from 'underscore';
import { Radio } from 'marionette';
import Backbone from 'backbone';

import App from 'js/base/app';

import SidebarService from 'js/services/sidebar';

import PreloadRegion from 'js/regions/preload_region';

import NavApp from 'js/apps/globals/nav/nav_app';

export default App.extend({
  initialize() {
    this.routers = [];
    this.listenTo(Radio.channel('workspace'), 'change:workspace', () => this.restart());
  },
  onBeforeStart() {
    this.getOption('contentRegion').empty();

    if (this.hasChildApp('nav')) return;

    const navApp = this.addChildApp('nav', new NavApp({
      region: this.getOption('navRegion'),
    }));
    const navState = navApp.getState();

    this.listenTo(navState, 'change:isMinimized', this.onChangeNavMinimized);
    this.onChangeNavMinimized(navState, navState.get('isMinimized'));

    new SidebarService({ region: this.getOption('sidebarRegion') });
  },
  onChangeNavMinimized(state, isMinimized) {
    this.getOption('setNavMinimized')(isMinimized);
  },
  async prepareStart(options, { signal }) {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const hasDashboards = currentUser.can('dashboards:view');
    const hasClinicians = currentUser.can('clinicians:manage');
    const hasPrograms = currentUser.can('programs:manage');

    const results = await Promise.all([
      Radio.request('workspace', 'fetch'),
      import('js/apps/patients/patients-main_app'),
      hasDashboards ?
        import('js/apps/dashboards/dashboards-main_app.js') :
        null,
      hasClinicians ?
        import('js/apps/clinicians/clinicians-main_app.js') :
        null,
      hasPrograms ? import('js/apps/programs/programs-main_app.js') : null,
    ]);

    if (signal.aborted) return;

    const navStarted = await this.getChildApp('nav').start();

    if (signal.aborted) return;
    if (!navStarted) throw new Error('Navigation startup was canceled');

    return results;
  },
  onStart(
    app,
    options,
    [
      currentWorkspace,
      PatientsMainApp,
      DashboardsMainApp,
      CliniciansMainApp,
      ProgramsMainApp,
    ],
  ) {
    this.workspaceSlug = currentWorkspace.get('slug');

    this.initRouter(PatientsMainApp);
    this.initRouter(DashboardsMainApp);
    this.initRouter(CliniciansMainApp);
    this.initRouter(ProgramsMainApp);

    Backbone.history.loadUrl();

    if (!some(this.routers, router => router.getCurrentRoute())) {
      Radio.trigger('event-router', 'notFound');
    }
  },
  async prepareStop(options) {
    for (const router of this.routers) {
      await this.removeChildApp(router.getName(), options);
    }

    this.routers = [];
  },
  initRouter(module) {
    const RouterApp = module?.default;
    if (!RouterApp) return;

    // each router owns a region over the shared content element so that
    // stopping an unmatched router cannot empty the displayed router's view
    const router = new RouterApp({
      region: {
        el: this.getOption('contentRegion').el,
        regionClass: PreloadRegion,
      },
      workspaceSlug: this.workspaceSlug,
    });

    this.addChildApp(router.routerAppName, router);

    this.listenTo(router, 'before:appRoute', this.onBeforeAppRoute);

    this.routers.push(router);
    return router;
  },
  onBeforeAppRoute(router, routeContext) {
    const { event, eventArgs } = routeContext;

    Radio.request('nav', 'select', router.routerAppName, event, eventArgs);
    Radio.request('sidebar', 'stop');
    Radio.request('history', 'set:latestList', routeContext);
  },
});
