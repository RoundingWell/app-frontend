import { Radio, View } from 'marionette';
import Backbone from 'backbone';
import { mountApplication, mountRegion } from '@mnjs/test';
import { testScope } from '@mnjs/test/cypress';

import App from 'js/base/app';

import SidebarService from './sidebar';

const SidebarApp = App.extend({
  onStart() {
    this.showView(new View({ template: false }));
  },
});

context('Sidebar Service', function() {
  let scope;

  beforeEach(function() {
    scope = testScope();
  });

  function mountService(document) {
    return scope.own(mountApplication(region => new SidebarService({ region }), {
      document,
      start: false,
      replaceElement: true,
    }));
  }

  specify('reconstructs the current sidebar app when asked to start it again', function() {
    cy.document().then(async document => {
      const { app: service } = mountService(document);
      const sidebarApp = scope.own(new SidebarApp());

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
    });
  });

  specify('interleaved starts display only the latest app', function() {
    cy.document().then(async document => {
      const { app: service, container: element } = mountService(document);
      const superseded = scope.own(new SidebarApp());
      const latest = scope.own(new SidebarApp());

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
    });
  });

  specify('a stopping app leaves its replacement displayed', function() {
    cy.document().then(async document => {
      const { app: service, container: element } = mountService(document);
      const outgoing = scope.own(new SidebarApp());
      const incoming = scope.own(new SidebarApp());

      await service.start();

      await service.startSidebarApp(outgoing, {});
      await service.startSidebarApp(incoming, {});

      expect(outgoing.isRunning()).to.be.false;
      expect(incoming.isRunning()).to.be.true;
      expect(incoming.getView()).to.exist;
      expect(element.contains(incoming.getView().el)).to.be.true;

      await service.stopSidebarApp();
      await service.stop();
    });
  });

  specify('yields to a sidebar started while stopping the outgoing app', function() {
    cy.document().then(async document => {
      const { app: service, container: element } = mountService(document);
      const other = scope.own(new SidebarApp());
      const incoming = scope.own(new SidebarApp());
      let replacing;
      const outgoing = scope.own(new (SidebarApp.extend({
        onStop() {
          replacing ||= service.startSidebarApp(other, {});
        },
      }))());
      scope.defer(() => replacing);
      await service.start();
      await service.startSidebarApp(outgoing, {});

      expect(await service.startSidebarApp(incoming, {})).to.equal(undefined);
      expect(await replacing).to.equal(other);
      expect(service.currentApp).to.equal(other);
      expect(other.isRunning()).to.be.true;
      expect(incoming.isRunning()).to.be.false;
      expect(element.contains(other.getView().el)).to.be.true;
    });
  });

  specify('yields to a sidebar started while stopping the incoming app', function() {
    cy.document().then(async document => {
      const { app: service, container: element } = mountService(document);
      const { region: outsideRegion } = scope.own(mountRegion({ document }));
      const other = scope.own(new SidebarApp());
      let replacing;
      const incoming = scope.own(new (SidebarApp.extend({
        onStop() {
          replacing ||= service.startSidebarApp(other, {});
        },
      }))());
      scope.defer(() => replacing);
      await service.start();
      await incoming.start({ region: outsideRegion });

      expect(await service.startSidebarApp(incoming, {})).to.equal(undefined);
      expect(await replacing).to.equal(other);
      expect(service.currentApp).to.equal(other);
      expect(other.isRunning()).to.be.true;
      expect(incoming.isRunning()).to.be.false;
      expect(element.contains(other.getView().el)).to.be.true;
    });
  });

  specify('stops the active sidebar synchronously during service shutdown', function() {
    cy.document().then(async document => {
      const { app: service } = mountService(document);
      const sidebarApp = scope.own(new SidebarApp());
      await service.start();
      await service.startSidebarApp(sidebarApp, {});
      expect(service.stop()).to.equal(true);
      expect(sidebarApp.isRunning()).to.be.false;
    });
  });

  specify('cancels a pending sidebar replacement during service shutdown', function() {
    cy.document().then(async document => {
      const { app: service } = mountService(document);
      const outgoing = scope.own(new SidebarApp());
      let resolveStart;
      const ready = new Promise(resolve => {
        resolveStart = resolve;
      });
      const incoming = scope.own(new (SidebarApp.extend({ prepareStart() {
        return ready;
      } }))());
      await service.start();
      await service.startSidebarApp(outgoing, {});
      const replacing = service.startSidebarApp(incoming, {});
      scope.defer(async() => {
        service.stop();
        resolveStart();
        await replacing;
      });
      expect(outgoing.isRunning()).to.be.false;
      expect(service.stop()).to.equal(true);
      resolveStart();
      expect(await replacing).to.equal(undefined);
      expect(incoming.isRunning()).to.be.false;
    });
  });

  specify('rebinds a reusable app to a recreated shell without losing state', function() {
    cy.document().then(async document => {
      const { region: firstRegion, slot: firstElement } = scope.own(mountRegion({ document }));
      const { region: nextRegion, slot: nextElement } = scope.own(mountRegion({ document }));

      const service = scope.own(new SidebarService());
      const StatefulApp = SidebarApp.extend({
        createState() {
          return new Backbone.Model();
        },
      });
      const sidebarApp = scope.own(new StatefulApp());

      await service.start({ region: firstRegion });
      await service.startSidebarApp(sidebarApp, {});
      sidebarApp.getState().set('draft', 'preserved');
      await service.stop();

      await service.start({ region: nextRegion });
      await service.startSidebarApp(sidebarApp, {});

      expect(firstElement.children).to.have.length(0);
      expect(nextElement.contains(sidebarApp.getView().el)).to.be.true;
      expect(sidebarApp.getState().get('draft')).to.equal('preserved');

      await service.stop();
    });
  });

  specify('cleans failed preparation and reports its error', function() {
    cy
      .document()
      .then(async document => {
        const { app: service } = mountService(document);
        const onError = cy.stub();
        const channel = Radio.channel('event-router');
        channel.on('unknownError', onError);
        scope.defer(() => channel.off('unknownError', onError));
        await service.start();

        for (const error of [{ response: { status: 503 } }, new Error('Failed preparation')]) {
          const failed = scope.own(new (App.extend({
            prepareStart() {
              throw error;
            },
          }))());
          expect(await service.startSidebarApp(failed, {})).to.equal(undefined);
          expect(service.currentApp).to.equal(undefined);
          failed.destroy();
        }

        expect(onError).to.have.been.calledWith(503);
        expect(onError).to.have.been.calledWith(undefined);
      });
  });
});
