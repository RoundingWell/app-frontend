import { Radio, Region, View } from 'marionette';
import Backbone from 'backbone';

import App from 'js/base/app';

import SidebarService from './sidebar';

const SidebarApp = App.extend({
  onStart() {
    this.showView(new View({ template: false }));
  },
});

context('Sidebar Service', function() {
  specify('reconstructs the current sidebar app when asked to start it again', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');

      document.body.append(element);

      const service = new SidebarService({ region: new Region({ el: element }) });
      const sidebarApp = new SidebarApp();

      await service.start();

      const first = await service.startSidebarApp(sidebarApp, {});
      const firstView = sidebarApp.getView();
      const second = await service.startSidebarApp(sidebarApp, {});

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
      const superseded = new SidebarApp();
      const latest = new SidebarApp();

      await service.start();

      const both = Promise.all([
        service.startSidebarApp(superseded, {}),
        service.startSidebarApp(latest, {}),
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
      const outgoing = new SidebarApp();
      const incoming = new SidebarApp();

      await service.start();

      await service.startSidebarApp(outgoing, {});
      await service.startSidebarApp(incoming, {});

      expect(outgoing.isRunning()).to.be.false;
      expect(incoming.isRunning()).to.be.true;
      expect(incoming.getView()).to.exist;
      expect(element.contains(incoming.getView().el)).to.be.true;

      await service.stopSidebarApp();
      await service.stop();
      element.remove();
    });
  });

  specify('yields to a sidebar started while stopping the incoming app', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');
      const outsideElement = document.createElement('div');
      document.body.append(element, outsideElement);
      const service = new SidebarService({ region: new Region({ el: element }) });
      const other = new SidebarApp();
      let replacing;
      const incoming = new (SidebarApp.extend({
        onStop() {
          replacing ||= service.startSidebarApp(other, {});
        },
      }))();
      await service.start();
      await incoming.start({ region: new Region({ el: outsideElement }) });

      expect(await service.startSidebarApp(incoming, {})).to.equal(undefined);
      expect(await replacing).to.equal(other);
      expect(service.currentApp).to.equal(other);
      expect(other.isRunning()).to.be.true;
      expect(incoming.isRunning()).to.be.false;
      expect(element.contains(other.getView().el)).to.be.true;
      service.destroy();
      other.destroy();
      incoming.destroy();
      element.remove();
      outsideElement.remove();
    });
  });

  specify('stops the active sidebar synchronously during service shutdown', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');
      document.body.append(element);
      const service = new SidebarService({ region: new Region({ el: element }) });
      const sidebarApp = new SidebarApp();
      await service.start();
      await service.startSidebarApp(sidebarApp, {});
      expect(service.stop()).to.equal(true);
      expect(sidebarApp.isRunning()).to.be.false;
      service.destroy();
      sidebarApp.destroy();
      element.remove();
    });
  });

  specify('cancels a pending sidebar replacement during service shutdown', function() {
    cy.document().then(async document => {
      const element = document.createElement('div');
      document.body.append(element);
      const service = new SidebarService({ region: new Region({ el: element }) });
      const outgoing = new SidebarApp();
      let resolveStart;
      const ready = new Promise(resolve => {
        resolveStart = resolve;
      });
      const incoming = new (SidebarApp.extend({ prepareStart() {
        return ready;
      } }))();
      await service.start();
      await service.startSidebarApp(outgoing, {});
      const replacing = service.startSidebarApp(incoming, {});
      expect(outgoing.isRunning()).to.be.false;
      expect(service.stop()).to.equal(true);
      resolveStart();
      expect(await replacing).to.equal(undefined);
      expect(incoming.isRunning()).to.be.false;
      service.destroy();
      outgoing.destroy();
      incoming.destroy();
      element.remove();
    });
  });

  specify('rebinds a reusable app to a recreated shell without losing state', function() {
    cy.document().then(async document => {
      const firstElement = document.createElement('div');
      const nextElement = document.createElement('div');

      document.body.append(firstElement, nextElement);

      const service = new SidebarService();
      const StatefulApp = SidebarApp.extend({
        createState() {
          return new Backbone.Model();
        },
      });
      const sidebarApp = new StatefulApp();

      await service.start({ region: new Region({ el: firstElement }) });
      await service.startSidebarApp(sidebarApp, {});
      sidebarApp.getState().set('draft', 'preserved');
      await service.stop();

      await service.start({ region: new Region({ el: nextElement }) });
      await service.startSidebarApp(sidebarApp, {});

      expect(firstElement.children).to.have.length(0);
      expect(nextElement.contains(sidebarApp.getView().el)).to.be.true;
      expect(sidebarApp.getState().get('draft')).to.equal('preserved');

      await service.stop();
      firstElement.remove();
      nextElement.remove();
    });
  });

  specify('cleans failed preparation and reports its error', function() {
    cy
      .document()
      .then(async document => {
        const element = document.createElement('div');
        document.body.append(element);
        const service = new SidebarService({ region: new Region({ el: element }) });
        const onError = cy.stub();
        const channel = Radio.channel('event-router');
        channel.on('unknownError', onError);
        await service.start();

        for (const error of [{ response: { status: 503 } }, new Error('Failed preparation')]) {
          const failed = new (App.extend({
            prepareStart() {
              throw error;
            },
          }))();
          expect(await service.startSidebarApp(failed, {})).to.equal(undefined);
          expect(service.currentApp).to.equal(undefined);
          failed.destroy();
        }

        expect(onError).to.have.been.calledWith(503);
        expect(onError).to.have.been.calledWith(undefined);
        channel.off('unknownError', onError);
        service.destroy();
        element.remove();
      });
  });
});
