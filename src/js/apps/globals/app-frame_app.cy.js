import Backbone from 'backbone';
import Radio from 'backbone.radio';

import AppFrameApp from './app-frame_app';

context('AppFrameApp', function() {
  let app;
  let navSelect;
  let sidebarStop;
  let applyRoute;

  beforeEach(function() {
    navSelect = cy.stub();
    sidebarStop = cy.stub();
    applyRoute = cy.stub();

    Radio.reply('nav', 'select', navSelect);
    Radio.reply('sidebar', 'stop', sidebarStop);
    Radio.reply('history', 'apply:route', applyRoute);

    app = new AppFrameApp();
  });

  afterEach(function() {
    app.destroy();
    Radio.reset();
  });

  specify('coordinates global shell behavior before an area route', function() {
    const routeContext = {
      event: 'worklist',
      eventArgs: ['owned-by'],
      definition: {
        meta: { isList: true },
      },
    };

    app.onBeforeAppRoute({ routerAppName: 'PatientsApp' }, routeContext);

    expect(navSelect).to.have.been.calledWith('PatientsApp', 'worklist', ['owned-by']);
    expect(sidebarStop).to.have.been.calledOnce;
    expect(applyRoute).to.have.been.calledWith(routeContext);
  });

  specify('passes the current workspace slug to area routers', function() {
    let routerOptions;
    const RouterApp = function(options) {
      routerOptions = options;
    };

    Object.assign(RouterApp.prototype, Backbone.Events, {
      destroy() {},
    });

    app.workspaceSlug = 'test-ws';
    app.getRegion = cy.stub().withArgs('content').returns('content-region');

    app.initRouter({ default: RouterApp });

    expect(routerOptions).to.deep.equal({
      region: 'content-region',
      workspaceSlug: 'test-ws',
    });
  });

  specify('wires form app start and stop to nav visibility', function() {
    const formsApp = Object.assign({}, Backbone.Events);
    const RouterApp = function() {
      return formsApp;
    };

    app.workspaceSlug = 'test-ws';
    app.getRegion = cy.stub().withArgs('content').returns('content-region');
    app.toggleNav = cy.stub();

    app.initFormsApp({ default: RouterApp });

    formsApp.trigger('start');
    formsApp.trigger('stop');

    expect(app.toggleNav).to.have.been.calledWith(false);
    expect(app.toggleNav).to.have.been.calledWith(true);
  });

  specify('toggles the nav when running', function() {
    const toggleNav = cy.stub();

    app.isRunning = cy.stub().returns(true);
    app.getView = cy.stub().returns({ toggleNav });

    app.toggleNav(true);

    expect(toggleNav).to.have.been.calledWith(true);
  });
});
