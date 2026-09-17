import { Region } from 'marionette';

import App from 'js/base/app';

import SidebarService from './sidebar';

context('Sidebar Service', function() {
  specify('keeps the current sidebar app when asked to start it again', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const sidebarApp = new App({ region: service.getSidebarRegion() });

      await service.start();

      const first = await service.startSidebarApp(sidebarApp, {}, {});
      const second = await service.startSidebarApp(sidebarApp, {}, {});

      expect(first).to.equal(sidebarApp);
      expect(second).to.equal(sidebarApp);
      expect(sidebarApp.isRunning()).to.be.true;
      expect(sidebarApp.getRegion()).to.not.equal(service.getRegion());

      await service.stopSidebarApp();

      expect(sidebarApp.isRunning()).to.be.false;

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
});
