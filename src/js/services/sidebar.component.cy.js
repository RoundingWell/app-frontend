import { Region } from 'marionette';

import App from 'js/base/app';

import SidebarService from './sidebar';

context('Sidebar Service', function() {
  specify('keeps the current sidebar app when asked to start it again', function() {
    cy.document().then(document => {
      const element = document.createElement('div');
      const service = new SidebarService();
      const sidebarApp = new App();

      document.body.append(element);
      service.setRegion(new Region({ el: element }));
      service.start();

      const first = service.startSidebarApp(sidebarApp, {}, {});
      const second = service.startSidebarApp(sidebarApp, {}, {});

      expect(first).to.equal(sidebarApp);
      expect(second).to.equal(sidebarApp);
      expect(sidebarApp.isRunning()).to.be.true;

      service.stopSidebarApp();
      service.stop();
      element.remove();
    });
  });
});
