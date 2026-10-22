import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import { getFocusableElements } from 'js/utils/accessibility/focus-trap';

import {
  ModalView,
  SmallModalView,
  IframeFormView,
} from './modal_views';

context('Modal Views', function() {
  specify('does not cancel a focus frame before the dialog has been attached', function() {
    cy.window().then(win => {
      const cancelAnimationFrame = cy.spy(win, 'cancelAnimationFrame');
      const modal = new ModalView();

      expect(modal.isAttached()).to.equal(false);
      modal.destroy();

      expect(modal.isDestroyed()).to.equal(true);
      expect(cancelAnimationFrame, 'unattached dialog has no focus frame to cancel').not.to.have.been.called;
    });
  });

  specify('renders the small modal and form iframe', function() {
    const form = new Backbone.Model({ name: 'Example form' });
    const getFormUrl = cy.stub().returns('/forms/example');
    form.getFormUrl = getFormUrl;

    cy.mount(() => new SmallModalView({ headingText: 'Small modal' }));

    cy.get('.modal--small').last().find('.js-close').first().click();

    cy.mount(() => new IframeFormView({ model: form }));

    cy.get('.modal__form-iframe iframe')
      .should('have.attr', 'src', '/forms/example')
      .and('have.attr', 'title', 'Example form')
      .then(() => {
        expect(getFormUrl).to.have.been.calledWith({ modal: 1 });
      });
  });

  specify('caps form modals at their desktop sizes', function() {
    cy.viewport(1600, 1000);

    cy.mount(() => new (ModalView.extend({
      className: 'modal modal--dialog modal--form-small',
      headingText: 'Small form',
    }))());

    cy.get('.modal--form-small').then($modal => {
      const bounds = $modal[0].getBoundingClientRect();
      expect(bounds.width).to.equal(640);
      expect(bounds.height).to.equal(560);
    });

    cy.mount(() => new (ModalView.extend({
      className: 'modal modal--dialog modal--form-large',
      headingText: 'Large form',
    }))());

    cy.get('.modal--form-large').then($modal => {
      const bounds = $modal[0].getBoundingClientRect();
      expect(bounds.width).to.equal(1120);
      expect(bounds.height).to.equal(800);
    });
  });

  specify('identifies dialogs and keeps keyboard focus inside', function() {
    cy.mount(() => {
      const AccessibleModalView = ModalView.extend({
        bodyText: 'Dialog content',
        headingText: 'Accessible dialog',
      });

      return new AccessibleModalView();
    });

    cy.get('.modal')
      .should('have.attr', 'role', 'dialog')
      .and('have.attr', 'aria-modal', 'true')
      .and('have.attr', 'aria-label', 'Accessible dialog');

    cy.get('.modal .js-close').first()
      .should('have.attr', 'aria-label', 'Close')
      .and('be.focused');

    cy.get('.modal .js-close').last()
      .focus()
      .trigger('keydown', { key: 'Tab' });

    cy.get('.modal .js-close').first().should('be.focused');

    cy.get('.modal .js-close').first()
      .trigger('keydown', { key: 'Tab', shiftKey: true });

    cy.get('.modal .js-close').last().should('be.focused');
  });

  specify('prioritizes autofocus and includes iframe content in the focus boundary', function() {
    const BodyView = View.extend({
      template: hbs`
        <button type="button">Body action</button>
        <input aria-label="Preferred field" autofocus>
        <iframe title="Embedded content"></iframe>
      `,
    });

    const FocusBoundaryModal = ModalView.extend({
      bodyView: new BodyView(),
      headingText: 'Focus boundary',
    });

    cy.mount(() => new FocusBoundaryModal());

    cy.get('input[aria-label="Preferred field"]').should('be.focused');

    cy.get('.modal').then($modal => {
      const focusable = getFocusableElements($modal[0]);

      expect(focusable.some(element => element.matches('iframe[title="Embedded content"]'))).to.equal(true);
    });
  });

  specify('names a dialog when the caller omits its heading', function() {
    cy.mount(() => new ModalView());

    cy.get('.modal').should('have.attr', 'aria-label', 'Details');
  });

  specify('falls back from disabled autofocus', function() {
    const BodyView = View.extend({
      template: hbs`<input aria-label="Disabled field" autofocus disabled>`,
    });

    cy.mount(() => new (ModalView.extend({
      bodyView: new BodyView(),
      headingText: 'Focus fallback',
    }))());

    cy.get('.modal__close').should('be.focused');
  });

  specify('traps keyboard focus at visible controls and the dialog container', function() {
    const FooterView = View.extend({
      template: hbs`
        <button class="visible-action" type="button">Visible action</button>
        <button type="button" style="visibility: hidden">Hidden action</button>
      `,
    });

    cy.mount(() => new (ModalView.extend({
      footerView: new FooterView(),
      headingText: 'Focus boundary',
    }))());

    cy.get('.visible-action').focus().trigger('keydown', { key: 'Tab' });

    cy.get('.modal__close').should('be.focused');

    cy.get('.modal').focus().trigger('keydown', { key: 'Tab', shiftKey: true });

    cy.get('.visible-action').should('be.focused');
  });

  specify('excludes controls disabled by their fieldset from the focus boundary', function() {
    const FooterView = View.extend({
      template: hbs`
        <button class="enabled-action" type="button">Enabled action</button>
        <fieldset disabled>
          <button type="button">Disabled action</button>
        </fieldset>
      `,
    });

    cy.mount(() => new (ModalView.extend({
      footerView: new FooterView(),
      headingText: 'Fieldset focus boundary',
    }))());

    cy.get('.enabled-action').focus().trigger('keydown', { key: 'Tab' });

    cy.get('.modal__close').should('be.focused');

    cy.get('.modal__close').trigger('keydown', { key: 'Tab', shiftKey: true });

    cy.get('.enabled-action').should('be.focused');
  });

  specify('wraps keyboard focus in sequential tabindex order', function() {
    const BodyView = View.extend({
      template: hbs`
        <button type="button" tabindex="2">Second priority</button>
        <button type="button" tabindex="1">First priority</button>
        <button type="button" tabindex="1">Tied priority</button>
        <button type="button">Body action</button>
      `,
    });

    cy.mount(() => new (ModalView.extend({
      bodyView: new BodyView(),
      headingText: 'Sequential focus boundary',
    }))());

    cy.get('.modal .js-close').last().focus();

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.contains('button', 'First priority').should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.contains('button', 'Tied priority').should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.contains('button', 'Second priority').should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.get('.modal__close').should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.contains('button', 'Body action').should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.get('.modal .js-submit').should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.get('.modal .js-close').last().should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy.contains('button', 'First priority')
      .should('be.focused')
      .trigger('keydown', { key: 'Tab', shiftKey: true });

    cy.get('.modal .js-close').last().should('be.focused');
  });

  specify('keeps focus in an upper dialog when the lower dialog is destroyed', function() {
    let root;
    const lower = new ModalView({ headingText: 'Lower dialog' });
    const upper = new SmallModalView({ headingText: 'Upper dialog' });

    cy.mount(rootView => {
      root = rootView;
      return new View({ template: hbs`<button>Opener</button>` });
    });

    cy.contains('button', 'Opener').focus();

    cy.then(() => root.getRegion('modal').show(lower));

    cy.get('.modal__close').should('be.focused');

    cy.then(() => root.getRegion('modalSmall').show(upper));

    cy.get('.modal--small .modal__close').should('be.focused');

    cy.window().then(win => {
      lower.destroy();
      return new Cypress.Promise(resolve => win.requestAnimationFrame(resolve));
    });

    cy.get('.modal--small .modal__close').should('be.focused');
  });

  specify('respects Escape consumed by a dialog control', function() {
    let root;
    const BodyView = View.extend({
      template: hbs`<button class="consumes-escape" type="button">Dismiss suggestion</button>`,
      events: {
        keydown(event) {
          event.preventDefault();
        },
      },
    });

    cy.mount(rootView => {
      root = rootView;
      return new View({ template: false });
    });

    cy.then(() => root.getRegion('modal').show(new (ModalView.extend({
      bodyView: new BodyView(),
      headingText: 'Suggestions',
    }))()));

    cy.get('.consumes-escape')
      .focus()
      .trigger('keydown', { key: 'Escape', which: 27 });

    cy.get('.modal').should('be.visible').and('have.attr', 'aria-label', 'Suggestions');
  });

  specify('uses full-height mobile dialogs while keeping confirmations compact', function() {
    cy.viewport(390, 844);

    cy.mount(() => new (ModalView.extend({ headingText: 'Full dialog' }))());

    cy.get('.modal').then($modal => {
      const bounds = $modal[0].getBoundingClientRect();
      expect(bounds.height).to.equal(844);
      expect(bounds.width).to.equal(390);
    });

    cy.get('.modal .modal__header > .js-close, .modal .modal__footer button')
      .should($controls => {
        [...$controls].forEach(control => {
          const bounds = control.getBoundingClientRect();
          expect(bounds.height).to.be.at.least(44);
        });
      });

    cy.mount(() => new (SmallModalView.extend({ headingText: 'Confirmation' }))());

    cy.get('.modal--small').then($modal => {
      const bounds = $modal[0].getBoundingClientRect();
      expect(bounds.height).to.be.lessThan(844);
      expect(bounds.width).to.be.lessThan(390);
    });
  });
});
