import Backbone from 'backbone';

import {
  ModalView,
  SmallModalView,
  IframeFormView,
} from './modal_views';

context('Modal Views', function() {
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
