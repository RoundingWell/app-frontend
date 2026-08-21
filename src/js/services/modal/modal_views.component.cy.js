import Backbone from 'backbone';

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

  specify('renders the small modal and form iframe', function() {
    const form = new Backbone.Model();
    const getFormUrl = cy.stub().returns('/forms/example');
    form.getFormUrl = getFormUrl;

    cy.mount(() => new SmallModalView({ headingText: 'Small modal' }));

    cy.get('.modal--small').last().find('.js-close').first().click();

    cy.mount(() => new IframeFormView({ model: form }));

    cy.get('.modal__form-iframe iframe')
      .should('have.attr', 'src', '/forms/example')
      .then(() => {
        expect(getFormUrl).to.have.been.calledWith({ modal: 1 });
      });
  });

  specify('caps form modals at their desktop sizes', function() {
    cy.viewport(1600, 1000);

    cy.mount(() => new (ModalView.extend({
      className: 'modal modal--form modal--form-small',
      headingText: 'Small form',
    }))());

    cy.get('.modal--form-small').then($modal => {
      const bounds = $modal[0].getBoundingClientRect();
      expect(bounds.width).to.equal(640);
      expect(bounds.height).to.equal(560);
    });

    cy.mount(() => new (ModalView.extend({
      className: 'modal modal--form modal--form-large',
      headingText: 'Large form',
    }))());

    cy.get('.modal--form-large').then($modal => {
      const bounds = $modal[0].getBoundingClientRect();
      expect(bounds.width).to.equal(1120);
      expect(bounds.height).to.equal(800);
    });
  });
});
