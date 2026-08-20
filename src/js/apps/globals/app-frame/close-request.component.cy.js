import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

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

    watchers.at(-1).requestClose();

    expect(closeLower).to.have.been.calledOnce;
  });

  specify('routes Escape through the active layer stack with or without CloseWatcher', function() {
    const event = { preventDefault: cy.stub() };
    const layer = {};
    const close = cy.stub().callsFake(() => manager.unregister(layer));

    manager = new CloseRequestManager({ CloseWatcher: TestCloseWatcher });
    manager.register(layer, close);
    Radio.trigger('hotkey', 'close', event);

    expect(close).to.have.been.calledOnce;
    expect(event.preventDefault).to.have.been.calledOnce;

    manager.destroy();
    manager = new CloseRequestManager({ CloseWatcher: null });
    manager.register(layer, close);
    Radio.trigger('hotkey', 'close', event);

    expect(close).to.have.been.calledTwice;
  });

  specify('routes Escape from text fields when CloseWatcher is unavailable', function() {
    const layer = {};
    const close = cy.stub().callsFake(() => manager.unregister(layer));

    cy.mount(rootView => {
      manager = rootView.closeRequestManager;
      manager.CloseWatcher = null;
      manager.register(layer, close);

      return new View({ template: hbs`<input class="qa-input" type="text">` });
    });

    cy
      .get('.qa-input')
      .focus()
      .type('{esc}')
      .then(() => {
        expect(close).to.have.been.calledOnce;
      });
  });
});
