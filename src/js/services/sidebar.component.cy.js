import { Region } from 'marionette';

import App from 'js/base/app';

import SidebarService from './sidebar';

context('Sidebar Service', function() {
  specify('restarts the current sidebar app when asked to start it again', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const sidebarApp = new App({ region: service.getSidebarRegion() });

      await service.start();

      const first = await service.startSidebarApp(sidebarApp, {}, {});
      const firstView = sidebarApp.getView();
      const second = await service.startSidebarApp(sidebarApp, {}, {});

      expect(first).to.equal(sidebarApp);
      expect(second).to.equal(sidebarApp);
      expect(sidebarApp.isRunning()).to.be.true;
      expect(firstView.isDestroyed()).to.be.true;
      expect(sidebarApp.getView()).to.not.equal(firstView);
      expect(sidebarApp.getRegion()).to.not.equal(service.getRegion());

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
      const superseded = new App({ region: service.getSidebarRegion() });
      const latest = new App({ region: service.getSidebarRegion() });

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
      const outgoing = new App({ region: service.getSidebarRegion() });
      const incoming = new App({ region: service.getSidebarRegion() });

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

  specify('clears a replacement claim when the outgoing stop fails', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const outgoing = new App({ region: service.getSidebarRegion() });
      const incoming = new App({ region: service.getSidebarRegion() });

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
