import { some } from 'underscore';
import { Radio } from 'marionette';
import Backbone from 'backbone';

import App from 'js/base/app';

import SidebarService from 'js/services/sidebar';

export default App.extend({
  childApps: {
    sidebar: SidebarService,
  },
  initialize() {
    this.routers = [];
  },
  onBeforeStart(app, options) {
    this.shellOptions = options;
  },
  async prepareStart(options, { signal }) {
    for (const router of this.routers) {
      await this.removeChildApp(router.getName());
      signal.throwIfAborted();
    }
    this.routers = [];

    const currentUser = Radio.request('bootstrap', 'currentUser');
    const hasDashboards = currentUser.can('dashboards:view');
    const hasClinicians = currentUser.can('clinicians:manage');
    const hasPrograms = currentUser.can('programs:manage');

    const results = await Promise.all([
      Radio.request('workspace', 'fetch', { workspace: options.workspace, signal }),
      import('js/apps/patients/patients-main_app'),
      hasDashboards ?
        import('js/apps/dashboards/dashboards-main_app.js') :
        null,
      hasClinicians ?
        import('js/apps/clinicians/clinicians-main_app.js') :
        null,
      hasPrograms ? import('js/apps/programs/programs-main_app.js') : null,
    ]);

    signal.throwIfAborted();

    await this.getChildApp('sidebar').start({ region: options.sidebarRegion });

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
