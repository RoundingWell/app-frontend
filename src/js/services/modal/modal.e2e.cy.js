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
          className: 'modal--small custom-class',
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
        Radio.request('modal', 'show', {
          footerView: false,
          bodyText: 'No Footer',
        });
      });

    cy
      .get('.modal')
      .then(modal => {
        expect(modal).to.not.have.class('modal__footer');
      });

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
      .get('.fill-window--dark.is-shown')
      .last()
      .click('left')
      .get('.modal--small')
      .should('not.exist');

    cy
      .get('.modal')
      .contains('Modal')
      .get('.fill-window--dark.is-shown')
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
      .get('.loader')
      .get('.fill-window--dark.is-shown')
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
      .get('.fill-window--dark.is-shown')
      .click('right');

    cy
      .getRadio(Radio => {
        Radio.request('modal', 'show:sidebar', {
          headingText: 'Sidebar Modal Header',
          bodyText: 'Sidebar Modal, this guy is anchored to the right side of the window.',
        });
      });

    cy
      .get('.modal--sidebar')
      .find('.modal__header')
      .should('contain', 'Sidebar Modal Header')
      .next()
      .should('contain', 'Sidebar Modal, this guy is anchored to the right side of the window.');

    cy
      .get('.modal--sidebar')
      .find('.js-close')
      .first()
      .click();

    cy
      .get('.modal--sidebar')
      .should('not.exist');
  });
});
