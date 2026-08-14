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

  specify('renders the small modal and both iframe size variants', function() {
    const form = new Backbone.Model();
    const getFormUrl = cy.stub().returns('/forms/example');
    form.getFormUrl = getFormUrl;

    cy.mount(() => new SmallModalView({ headingText: 'Small modal' }));

    cy.get('.modal--small').last().find('.js-close').first().click();

    cy.mount(() => new IframeFormView({ model: form, size: 'small' }));

    cy.get('.modal__form-iframe--small iframe')
      .should('have.attr', 'src', '/forms/example')
      .then(() => {
        expect(getFormUrl).to.have.been.calledWith({ modal: 1 });
      });

    cy.mount(() => new IframeFormView({ model: form }));

    cy.get('.modal__form-iframe')
      .should('not.have.class', 'modal__form-iframe--small');
  });
});
