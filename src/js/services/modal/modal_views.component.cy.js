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
  specify('shows the saving state in the footer', function() {
    let modal;

    cy.mount(() => {
      const SavingModalView = ModalView.extend({
        savingInfoText: 'Saving changes',
        savingSubmitText: 'Saving',
      });
      modal = new SavingModalView({
        headingText: 'Save changes',
        bodyText: 'Current content',
      });
      return modal;
    });

    cy.then(() => modal.showSavingFooter());

    cy.get('.modal__footer-saving-info')
      .should('contain', 'Saving changes')
      .next('button')
      .should('be.disabled')
      .and('contain', 'Saving');

    cy.then(() => modal.destroy());
  });

  specify('renders the small modal and both iframe size variants', function() {
    const form = new Backbone.Model({ name: 'Example form' });
    const getFormUrl = cy.stub().returns('/forms/example');
    form.getFormUrl = getFormUrl;

    cy.mount(() => new SmallModalView({ headingText: 'Small modal' }));

    cy.get('.modal--small').last().find('.js-close').first().click();

    cy.mount(() => new IframeFormView({ model: form, size: 'small' }));

    cy.get('.modal__form-iframe--small iframe')
      .should('have.attr', 'src', '/forms/example')
      .and('have.attr', 'title', 'Example form')
      .then(() => {
        expect(getFormUrl).to.have.been.calledWith({ modal: 1 });
      });

    cy.mount(() => new IframeFormView({ model: form }));

    cy.get('.modal__form-iframe')
      .should('not.have.class', 'modal__form-iframe--small');
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
