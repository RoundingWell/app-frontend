import { some } from 'underscore';
import { Radio } from 'marionette';
import Backbone from 'backbone';

import App from 'js/base/app';

import SidebarService from 'js/services/sidebar';

import NavApp from 'js/apps/globals/nav/nav_app';

export default App.extend({
  childApps: {
    nav: NavApp,
    sidebar: SidebarService,
  },
  initialize() {
    this.routers = [];
    const navApp = this.getChildApp('nav');
    const navState = navApp.getState();

    this.listenTo(navState, 'change:isMinimized', this.onChangeNavMinimized);

    this.listenTo(Radio.channel('workspace'), 'change:workspace', () => {
      if (this.isRunning()) this.restart(this.shellOptions);
    });
  },
  onBeforeStart(app, options) {
    this.shellOptions = options;
    this.onChangeNavMinimized(this.getChildApp('nav').getState(), this.getChildApp('nav').getState().get('isMinimized'));
  },
  onChangeNavMinimized(state, isMinimized) {
    this.shellOptions.setNavMinimized(isMinimized);
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

    const [navStarted, sidebarStarted] = await Promise.all([
      this.getChildApp('nav').start({ region: options.navRegion }),
      this.getChildApp('sidebar').start({ region: options.sidebarRegion }),
    ]);

    if (signal.aborted) return;
    if (!navStarted) throw new Error('Navigation startup was canceled');
    if (!sidebarStarted) throw new Error('Sidebar startup was canceled');

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

    const router = new RouterApp({
      routeRegion: this.shellOptions.contentRegion,
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
