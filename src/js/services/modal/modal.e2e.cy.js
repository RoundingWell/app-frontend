import { testForm } from 'support/api/forms';

context('Modal Service', function() {
  const smallOnModal = () => {
    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show', {
          headingText: 'Modal Header',
          bodyText: 'Modal, which is under the small modal.',
        });
      });

    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show:small', {
          headingText: 'Small Modal Header',
          bodyText: 'Small Modal, this guy shows over the top of the modal.',
        });
      });
  };

  specify('preserves form input on Escape and ignores modified Escape', function() {
    cy.routeActions().visit().wait('@routeActions');

    cy.getRadio(Radio => {
      Radio.request('modal', 'show', {
        headingText: 'Edit name',
        bodyHTML: '<input class="name-input" aria-label="Name">',
      });
    });

    cy.get('.name-input').type('Unsubmitted name');

    cy.press(Cypress.Keyboard.Keys.ESC);

    cy.get('.name-input').should('have.value', 'Unsubmitted name');

    cy.get('.modal__close')
      .focus()
      .trigger('keydown', { key: 'Escape', shiftKey: true });

    cy.get('.name-input').should('have.value', 'Unsubmitted name');

    cy.press(Cypress.Keyboard.Keys.ESC);

    cy.get('.modal').should('not.exist');
  });

  specify('Displaying', function() {
    const buttonStub = cy.stub();
    cy
      .routeActions()
      .visit()
      .wait('@routeActions');

    smallOnModal();

    cy
      .get('.modal--small')
      .should('contain', 'Small Modal')
      .find('.modal__footer')
      .find('.js-close')
      .click();

    cy
      .get('.modal')
      .should('contain', 'Modal')
      .find('.modal__footer')
      .find('.js-close')
      .click();

    // Visual layer order stays fixed when the lower dialog opens later.
    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show:small', {
          headingText: 'Upper confirmation',
        });
        Radio.request('modal', 'show', {
          headingText: 'Lower dialog',
        });
      });

    cy
      .get('.modal--small')
      .should('be.visible')
      .find('.modal__close')
      .focus();

    cy.press(Cypress.Keyboard.Keys.ESC);

    cy
      .get('.modal--small')
      .should('not.exist');

    cy
      .get('.modal')
      .should('have.attr', 'aria-label', 'Lower dialog')
      .find('.modal__close')
      .focus();

    cy.press(Cypress.Keyboard.Keys.ESC);

    cy
      .get('.modal')
      .should('not.exist');

    // Close using the X icon
    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show:small', {
          headingText: 'Small Modal Header',
          bodyText: 'Small Modal',
          onCancel: buttonStub,
        });
      });

    cy
      .get('.modal--small')
      .find('.js-close .icon')
      .click()
      .then(() => {
        expect(buttonStub).to.be.calledOnce;
        buttonStub.resetHistory();
      });

    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show:small', {
          headingText: 'Close On Save',
          bodyText: 'Default onSave behavior. Also a cool custom class!',
          buttonClass: 'save-button',
          className: 'modal modal--dialog modal--small custom-class',
        });
      });

    cy
      .get('.modal--small')
      .should('have.class', 'custom-class')
      .find('.save-button')
      .click();

    cy
      .get('.modal--small')
      .should('not.exist');

    cy
      .getRadio(Radio => {
        const modal = Radio.request('modal', 'show', {
          bodyText: 'Submit Disabled',
          onSubmit: () => {
            modal.disableSubmit(true);
          },
        });
      });

    cy
      .get('.modal')
      .find('.js-submit')
      .click()
      .should('be.disabled');

    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show', {
          onSubmit: buttonStub,
        });
      });

    cy
      .get('.modal')
      .find('.js-submit')
      .click()
      .then(() => {
        expect(buttonStub).to.be.calledOnce;
        buttonStub.resetHistory();
      });

    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show', {
          onCancel: buttonStub,
        });
      });

    cy
      .get('.modal')
      .find('.js-close')
      .last() // Close Button
      .click()
      .then(() => {
        expect(buttonStub).to.be.calledOnce;
        buttonStub.resetHistory();
      });

    smallOnModal();

    // click the overlay, modal should stll be there
    cy
      .get('.fill-window.fill-window--dark.is-shown')
      .last()
      .click('left')
      .get('.modal--small')
      .should('not.exist');

    cy
      .get('.modal')
      .contains('Modal')
      .get('.fill-window.fill-window--dark.is-shown')
      .click('left')
      .get('.modal')
      .should('not.exist');

    cy
      .getRadio(Radio => {
        const modal = Radio.request('modal', 'show', {
          bodyText: 'Hi',
        });
        modal.startPreloader();
      });

    cy
      .get('.modal .loader__indicator')
      .should('have.class', 'skeleton-loading--immediate')
      .find('.loader__indicator-dot')
      .should('have.lengthOf', 3)
      .get('.fill-window.fill-window--dark.is-shown')
      .click('right');

    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show', {
          headerView: 'Custom Header',
          bodyView: 'Custom Body',
          footerView: 'Custom Footer',
        });
      });

    cy
      .get('.modal')
      .contains('Custom Header');

    cy
      .get('.modal')
      .contains('Custom Body');

    cy
      .get('.modal')
      .contains('Custom Footer');

    cy
      .get('.modal')
      .should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy
      .get('.modal')
      .should('be.focused');

    cy
      .get('.fill-window.fill-window--dark.is-shown')
      .click('right');
  });

  specify('replacing an open form modal loads the new form', function() {
    cy
      .routeActions()
      .routeFormDefinition()
      .routeFormFields()
      .intercept('GET', '/forms/formio/**', { fixture: 'formio-stub.html' })
      .as('routeFormApp')
      .visit()
      .wait('@routeActions');

    const showForm = () => {
      cy
        .getRadio(Radio => {
          const patient = Radio.request('entities', 'patients:model', '1');
          const form = Radio.request('entities', 'forms:model', { id: testForm.id });

          Radio.request('modal', 'show:form', patient, 'Test Form', form);
        });
    };

    showForm();

    cy.wait('@routeFormApp');

    showForm();

    // The replacement modal renders its own iframe; waiting on the second
    // request ties the assertions below to the replacement, not the original.
    cy.wait('@routeFormApp');

    cy
      .get('.modal--form-large')
      .should('have.length', 1)
      .find('.js-submit')
      .should('not.be.disabled');
  });
});
