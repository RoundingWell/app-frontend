import { Region } from 'marionette';
import Backbone from 'backbone';

import App from 'js/base/app';

import SidebarService from './sidebar';

context('Sidebar Service', function() {
  specify('restarts the current sidebar app when asked to start it again', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const sidebarApp = new App();

      await service.start();

      const first = await service.startSidebarApp(sidebarApp, {}, {});
      const firstView = sidebarApp.getView();
      const second = await service.startSidebarApp(sidebarApp, {}, {});

      expect(first).to.equal(sidebarApp);
      expect(second).to.equal(sidebarApp);
      expect(sidebarApp.isRunning()).to.be.true;
      expect(firstView.isDestroyed()).to.be.true;
      expect(sidebarApp.getView()).to.not.equal(firstView);
      expect(sidebarApp.getRegion()).to.equal(service.getRegion());

      await service.stopSidebarApp();

      expect(sidebarApp.isRunning()).to.be.false;

      await service.stop();
      element.remove();
    });
  });

  specify('interleaved starts display only the latest app', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const superseded = new App();
      const latest = new App();

      await service.start();

      const both = Promise.all([
        service.startSidebarApp(superseded, {}, {}),
        service.startSidebarApp(latest, {}, {}),
      ]);

      expect(await both).to.deep.equal([undefined, latest]);
      expect(superseded.isRunning()).to.be.false;
      expect(superseded.getView()).to.not.exist;
      expect(element.children).to.have.length(1);
      expect(element.contains(latest.getView().el)).to.be.true;

      await service.stopSidebarApp();
      await service.stop();
      element.remove();
    });
  });

  specify('a stopping app leaves its replacement displayed', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const outgoing = new App();
      const incoming = new App();

      await service.start();

      await service.startSidebarApp(outgoing, {}, {});
      await service.startSidebarApp(incoming, {}, {});

      expect(outgoing.isRunning()).to.be.false;
      expect(incoming.isRunning()).to.be.true;
      expect(incoming.getView()).to.exist;
      expect(element.contains(incoming.getView().el)).to.be.true;

      await service.stopSidebarApp();
      await service.stop();
      element.remove();
    });
  });

  specify('rebinds a reusable app to a recreated shell without losing state', function() {
    cy.document().then(async document => {
      const firstElement = document.createElement('div');
      const nextElement = document.createElement('div');

      document.body.append(firstElement, nextElement);

      const service = new SidebarService();
      const StatefulApp = App.extend({
        createState() {
          return new Backbone.Model();
        },
      });
      const sidebarApp = new StatefulApp();

      await service.start({ region: new Region({ el: firstElement }) });
      await service.startSidebarApp(sidebarApp, {}, {});
      sidebarApp.getState().set('draft', 'preserved');
      await service.stop();

      await service.start({ region: new Region({ el: nextElement }) });
      await service.startSidebarApp(sidebarApp, {}, {});

      expect(firstElement.children).to.have.length(0);
      expect(nextElement.contains(sidebarApp.getView().el)).to.be.true;
      expect(sidebarApp.getState().get('draft')).to.equal('preserved');

      await service.stop();
      firstElement.remove();
      nextElement.remove();
    });
  });

  specify('clears a replacement claim when the outgoing stop fails', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const outgoing = new App();
      const incoming = new App();

      await service.start();
      await service.startSidebarApp(outgoing, {}, {});

      const stop = cy.stub(outgoing, 'stop').rejects(new Error('failed to stop'));
      let failure;

      try {
        await service.startSidebarApp(incoming, {}, {});
      } catch(error) {
        failure = error;
      }

      expect(failure.message).to.equal('failed to stop');
      expect(service.currentApp).to.not.exist;
      expect(service.currentClaim).to.not.exist;

      stop.restore();

      expect(await service.startSidebarApp(incoming, {}, {})).to.equal(incoming);

      await service.stopSidebarApp();
      await outgoing.stop();
      await service.stop();
      element.remove();
    });
  });
});
