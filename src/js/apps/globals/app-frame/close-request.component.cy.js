import { Radio } from 'marionette';

import CloseRequestManager from './close-request';

context('Close Request Manager', function() {
  let manager;
  let watchers;

  class TestCloseWatcher extends EventTarget {
    constructor() {
      super();
      this.destroy = cy.stub();
      watchers.push(this);
    }

    requestClose() {
      this.dispatchEvent(new Event('close'));
    }
  }

  beforeEach(function() {
    watchers = [];
    cy.clock();
  });

  afterEach(function() {
    manager?.destroy();
  });

  specify('closes only the highest active layer for platform close requests', function() {
    manager = new CloseRequestManager({ CloseWatcher: TestCloseWatcher });
    const lowerLayer = {};
    const upperLayer = {};
    const closeLower = cy.stub().callsFake(() => manager.unregister(lowerLayer));
    const closeUpper = cy.stub().callsFake(() => manager.unregister(upperLayer));

    manager.register(lowerLayer, closeLower);
    manager.register(upperLayer, closeUpper);

    watchers.at(-1).requestClose();

    expect(closeUpper).to.have.been.calledOnce;
    expect(closeLower).not.to.have.been.called;

    cy.tick(1).then(() => {
      watchers.at(-1).requestClose();

      expect(closeLower).to.have.been.calledOnce;
    });
  });

  specify('deduplicates native and hotkey handling for the same close request', function() {
    const event = { preventDefault: cy.stub() };
    const lowerLayer = {};
    const upperLayer = {};
    const closeLower = cy.stub().callsFake(() => manager.unregister(lowerLayer));
    const closeUpper = cy.stub().callsFake(() => manager.unregister(upperLayer));

    manager = new CloseRequestManager({ CloseWatcher: TestCloseWatcher });
    manager.register(lowerLayer, closeLower);
    manager.register(upperLayer, closeUpper);
    watchers.at(-1).requestClose();
    Radio.trigger('hotkey', 'close', event);

    expect(closeUpper).to.have.been.calledOnce;
    expect(closeLower).not.to.have.been.called;
    expect(event.preventDefault).not.to.have.been.called;
  });

  specify('uses the Escape hotkey when CloseWatcher is unavailable', function() {
    const event = { preventDefault: cy.stub() };
    const layer = {};
    const close = cy.stub().callsFake(() => manager.unregister(layer));

    manager = new CloseRequestManager({ CloseWatcher: null });
    manager.register(layer, close);
    Radio.trigger('hotkey', 'close', event);

    expect(close).to.have.been.calledOnce;
    expect(event.preventDefault).to.have.been.calledOnce;
  });

  specify('does not arm the lower layer during the same native Escape dispatch', function() {
    const lower = {};
    const upper = {};
    const closeLower = cy.stub();

    manager = new CloseRequestManager({ CloseWatcher: TestCloseWatcher });
    manager.register(lower, closeLower);
    manager.register(upper, cy.stub());

    manager.unregister(upper);

    expect(watchers).to.have.length(2);
    expect(watchers.at(-1).destroy).to.have.been.calledOnce;
    expect(Radio.request('close-request', 'close:top')).to.equal(false);
    expect(closeLower).not.to.have.been.called;

    cy.tick(1).then(() => {
      expect(watchers).to.have.length(3);
      watchers.at(-1).requestClose();
      expect(closeLower).to.have.been.calledOnce;
    });
  });

  specify('releases its watcher, pending close and Radio bindings on destruction', function() {
    const close = cy.stub();

    manager = new CloseRequestManager({ CloseWatcher: TestCloseWatcher });
    Radio.request('close-request', 'register', {}, close);
    const watcher = watchers.at(-1);

    Radio.request('close-request', 'close:top');
    manager.destroy();

    expect(watcher.destroy).to.have.been.calledOnce;
    expect(Radio.request('close-request', 'close:top')).to.equal(undefined);

    cy.tick(1).then(() => {
      Radio.trigger('hotkey', 'close', { preventDefault: cy.stub() });

      expect(close).to.have.been.calledOnce;
    });
  });
});
