import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import Droplist from './index';

context('Droplist', function() {
  const collection = new Backbone.Collection([
    { text: 'Option 1' },
    { text: 'Option 2' },
    { text: 'Option 3' },
  ]);

  specify('Displaying', function() {
    const headingText = 'Test Options';
    let droplist;

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        droplist = new Droplist({
          picklistOptions: {
            headingText,
          },
          collection,
          state: { isDisabled: true },
        });

        return droplist;
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .should('be.disabled')
      .then(() => {
        droplist.setState({ isDisabled: false });
      });

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .contains(headingText);

    cy
      .get('.picklist')
      .should('not.have.class', 'app-frame__pop-region--fullscreen')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@root')
      .contains('Option 1')
      .then(() => {
        droplist.setState({ selected: null });
      });

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .click();

    cy
      .get('@root')
      .contains('Option 3')
      .click();

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');
  });

  specify('isSelectlist', function() {
    const headingText = 'Test Options Very very long title';

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new Droplist({
          picklistOptions: {
            headingText,
            isSelectlist: true,
          },
          collection,
        });
      })
      .as('root');

    cy.get('@root').then($root => {
      $root.after('<button class="qa-after-droplist" type="button">After options</button>');
    });

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .should('not.have.class', 'app-frame__pop-region--fullscreen')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@root')
      .contains('Option 1')
      .click();

    cy
      .get('.picklist__input')
      .type('Opt 3');

    cy
      .get('.picklist__item')
      .find('div')
      .should('have.html', '<span><strong>Opt</strong>ion <strong>3</strong></span>');

    cy
      .get('.picklist__input')
      .type('{enter}');

    cy
      .get('@root')
      .contains('Option 3')
      .click();

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('@root')
      .contains('Option 3')
      .click();

    cy
      .get('.picklist__input')
      .focus();

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy
      .get('.qa-after-droplist')
      .filter(':focus')
      .should('have.length', 1);
  });

  specify('searchable lists use the mobile fullscreen presentation', function() {
    cy.viewport(390, 720);

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new Droplist({
          picklistOptions: {
            headingText: 'Test Options',
            isSelectlist: true,
          },
          collection,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .as('trigger')
      .click();

    cy
      .get('.picklist')
      .should('have.class', 'app-frame__pop-region--fullscreen')
      .and('have.attr', 'role', 'dialog')
      .and('have.attr', 'aria-modal', 'true')
      .and('have.attr', 'aria-label', 'Test Options')
      .then($picklist => {
        const bounds = $picklist[0].getBoundingClientRect();

        expect(bounds.top).to.equal(0);
        expect(bounds.left).to.equal(0);
        expect(bounds.width).to.equal(390);
        expect(bounds.height).to.equal(720);
      });

    cy
      .get('.picklist__mobile-header')
      .should('be.visible')
      .and('contain', 'Test Options');

    cy
      .get('.picklist__input')
      .should('be.focused');

    cy
      .get('.picklist__scroll')
      .should('have.attr', 'role', 'listbox')
      .find('.js-picklist-item')
      .first()
      .should('have.attr', 'role', 'option');

    cy
      .get('.picklist__input')
      .trigger('keydown', { key: 'Tab' });

    cy
      .get('.picklist__mobile-close')
      .should('be.focused')
      .trigger('keydown', { key: 'Tab', shiftKey: true });

    cy
      .get('.picklist__input')
      .should('be.focused');

    cy
      .window()
      .trigger('resize');

    cy
      .get('.picklist')
      .should('exist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('@root')
      .contains('Option 1')
      .should('be.focused')
      .click();

    cy
      .get('.picklist__mobile-close')
      .should('have.attr', 'aria-label', 'Close options')
      .find('.fa-arrow-left')
      .find('use')
      .should('have.attr', 'href', '#fas-fa-arrow-left')
      .closest('.picklist__mobile-close')
      .click();

    cy
      .get('[data-care-ops-fontawesome-symbols] #fas-fa-arrow-left')
      .should('exist');

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('@root')
      .contains('Option 1')
      .should('be.focused');
  });

  specify('Escape from search closes only the top fullscreen layer', function() {
    let droplist;

    cy.viewport(390, 720);

    cy
      .mount(rootView => {
        rootView.getRegion('modal').show(new View({
          className: 'qa-underlay',
          template: hbs`<input type="text">`,
        }));
        Droplist.setPopRegion(rootView.getRegion('pop'));
        droplist = new Droplist({
          picklistOptions: {
            headingText: 'Test Options',
            isSelectlist: true,
          },
          collection,
        });

        return droplist;
      })
      .then(() => {
        droplist.setState({ isActive: true });
      });

    cy
      .get('.picklist__input')
      .should('be.focused')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('.qa-underlay')
      .should('exist');
  });

  specify('non-search lists remain anchored on mobile', function() {
    cy.viewport(390, 720);

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new Droplist({ collection });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .should('not.have.class', 'app-frame__pop-region--fullscreen')
      .then($picklist => {
        expect($picklist[0].getBoundingClientRect().width).to.be.lessThan(390);
      });

    cy
      .get('.picklist__mobile-header')
      .should('not.be.visible');
  });

  specify('selectlist crosses the fullscreen breakpoint without losing its focused input', function() {
    cy.viewport(721, 720);

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new Droplist({
          picklistOptions: {
            isSelectlist: true,
          },
          collection,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist__input')
      .should('be.focused');

    cy
      .get('.picklist')
      .should('not.have.class', 'app-frame__pop-region--fullscreen');

    cy.viewport(720, 720);

    cy
      .get('.picklist')
      .should('have.class', 'app-frame__pop-region--fullscreen')
      .and('have.attr', 'role', 'dialog');

    cy.viewport(721, 720);

    cy
      .get('.picklist')
      .should('not.have.class', 'app-frame__pop-region--fullscreen')
      .then($picklist => {
        expect($picklist[0].style.left).not.to.equal('');
        expect($picklist[0].style.top).not.to.equal('');
      })
      .should('not.have.attr', 'role');

    cy
      .get('.picklist__input')
      .blur();

    cy
      .window()
      .trigger('resize');

    cy
      .get('.picklist')
      .should('not.exist');
  });

  specify('isCheckable', function() {
    const headingText = 'Test Options';

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new Droplist({
          picklistOptions: {
            headingText,
            isCheckable: true,
          },
          collection,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@root')
      .contains('Option 1')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .find('.icon')
      .should('have.class', 'fa-check');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .find('.icon')
      .should('not.exist');
  });
});
