import Radio from 'backbone.radio';

import PatientsApp from './patients-main_app';

context('Patient flow route resolution', function() {
  let app;
  let resolveFlow;
  let resolution;
  let currentRoute;
  let replaceRoute;
  let routeEvent;

  beforeEach(function() {
    app = new PatientsApp({ workspaceSlug: 'test-workspace' });
    app.start();

    currentRoute = cy.stub(app, 'getCurrentRoute').returns({ event: 'legacy:patient:flow' });
    replaceRoute = cy.stub(app, 'replaceRoute');
    routeEvent = cy.stub(Radio, 'trigger');

    const fetcher = new Promise(resolve => {
      resolveFlow = () => resolve({ getPatient: () => ({ id: 'test-patient' }) });
    });

    cy.stub(Radio, 'request')
      .withArgs('entities', 'fetch:flows:model', 'test-flow')
      .returns(fetcher);

    resolution = app.resolveFlowPatient('patient:flow', 'test-flow');
  });

  afterEach(function() {
    app.destroy();
  });

  specify('redirects a resolved flow while its source route is current', function() {
    resolveFlow();

    return resolution.then(() => {
      expect(replaceRoute).to.be.calledOnceWithExactly('patient:flow', 'test-patient', 'test-flow');
      expect(routeEvent).to.be.calledWithExactly('event-router', 'patient:flow', 'test-patient', 'test-flow');
    });
  });

  specify('ignores a flow that resolves after the patient app stops', function() {
    app.stop();
    resolveFlow();

    return resolution.then(() => {
      expect(replaceRoute).not.to.be.called;
      expect(routeEvent).not.to.be.calledWith('event-router', 'patient:flow');
    });
  });

  specify('ignores a flow that resolves after another patient route becomes current', function() {
    currentRoute.returns({ event: 'patient:workflow' });
    resolveFlow();

    return resolution.then(() => {
      expect(replaceRoute).not.to.be.called;
      expect(routeEvent).not.to.be.calledWith('event-router', 'patient:flow');
    });
  });
});
