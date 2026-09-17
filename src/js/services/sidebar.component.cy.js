import { Region } from 'marionette';

import App from 'js/base/app';

import SidebarService from './sidebar';

context('Sidebar Service', function() {
  specify('keeps the current sidebar app when asked to start it again', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const region = new Region({ el: element });
      const service = new SidebarService({ region });
      const sidebarApp = new App({ region });

      await service.start();

      const first = await service.startSidebarApp(sidebarApp, {}, {});
      const second = await service.startSidebarApp(sidebarApp, {}, {});

      expect(first).to.equal(sidebarApp);
      expect(second).to.equal(sidebarApp);
      expect(sidebarApp.isRunning()).to.be.true;

      await service.stopSidebarApp();

      expect(sidebarApp.isRunning()).to.be.false;

      await service.stop();
      element.remove();
    });
  });
});
