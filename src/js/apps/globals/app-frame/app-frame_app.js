import { invoke, some } from 'underscore';
import Radio from 'backbone.radio';
import Backbone from 'backbone';

import App from 'js/base/app';

import SidebarService from 'js/services/sidebar';

import NavApp from 'js/apps/globals/nav/nav_app';

export default App.extend({
  routers: [],
  onBeforeStart() {
    this.getRegion('content').empty();

    if (this.isRestarting()) return;

    const workspaceCh = Radio.channel('workspace');

    this.listenTo(workspaceCh, 'change:workspace', this.restart);

    new NavApp({ region: this.getRegion('nav') });
    new SidebarService({ region: this.getRegion('sidebar') });
  },
  beforeStart() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const hasDashboards = currentUser.can('dashboards:view');
    const hasClinicians = currentUser.can('clinicians:manage');
    const hasPrograms = currentUser.can('programs:manage');

    return [
      Radio.request('workspace', 'fetch'),
      import('js/apps/patients/patients-main_app'),
      hasDashboards ?
        import('js/apps/dashboards/dashboards-main_app.js') :
        null,
      hasClinicians ?
        import('js/apps/clinicians/clinicians-main_app.js') :
        null,
      hasPrograms ? import('js/apps/programs/programs-main_app.js') : null,
    ];
  },
  onStart(
    options,
    currentWorkspace,
    PatientsMainApp,
    DashboardsMainApp,
    CliniciansMainApp,
    ProgramsMainApp,
  ) {
    this.workspaceSlug = currentWorkspace.get('slug');

    this.initRouter(PatientsMainApp);
    this.initRouter(DashboardsMainApp);
    this.initRouter(CliniciansMainApp);
    this.initRouter(ProgramsMainApp);

    Backbone.history.loadUrl();

    if (!some(this.routers, router => router.isRunning())) {
      Radio.trigger('event-router', 'notFound');
    }
  },
  onStop() {
    invoke(this.routers, 'destroy');
    this.routers = [];
  },
  initRouter(module) {
    const RouterApp = module?.default;
    if (!RouterApp) return;

    const router = new RouterApp({
      region: this.getRegion('content'),
      workspaceSlug: this.workspaceSlug,
    });

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
