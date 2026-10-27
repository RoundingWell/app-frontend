import { fxCurrentClinician } from 'support/api/clinicians';

const minimizedKey = `isNavMenuMinimized_${ fxCurrentClinician.id }`;

function returnToFocusedNavLink() {
  // A tab switch can leave the same control active while it loses and regains focus.
  cy
    .focused()
    .should('have.class', 'app-nav__link')
    .and('have.class', 'is-selected')
    .trigger('focusout', { eventConstructor: 'FocusEvent', relatedTarget: null, force: true });
  cy
    .focused()
    .trigger('focusin', { eventConstructor: 'FocusEvent', relatedTarget: null, force: true });
}

context('Navigation focus restoration', function() {
  beforeEach(function() {
    localStorage.setItem(minimizedKey, true);

    cy
      .routesForDefault()
      .routePrograms()
      .visit();

    cy
      .get('[data-worklists-region] .app-nav__link')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('.worklist-list-page')
      .should('be.visible');

    cy
      .get('.app-nav')
      .should('have.class', 'app-nav--minimized')
      .should('not.have.class', 'is-full-nav-visible');
  });

  specify('keeps pointer-selected navigation closed on return and opens for fresh focus', function() {
    cy
      .get('[data-worklists-region] .app-nav__link')
      .eq(1)
      .click()
      .should('be.focused');

    cy
      .location('pathname')
      .should('equal', '/one/schedule');

    cy.press(Cypress.Keyboard.Keys.ESC);

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');

    returnToFocusedNavLink();
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');

    returnToFocusedNavLink();
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');

    cy
      .get('[data-worklists-region] .app-nav__link')
      .eq(1)
      .blur()
      .focus();

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');
  });

  specify('keeps keyboard-owned navigation open and accepts keyboard re-entry', function() {
    cy
      .get('.app-nav__header')
      .focus();

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('.js-minimize-menu')
      .focus()
      .should('be.focused');

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');

    cy
      .focused()
      .trigger('focusout', { eventConstructor: 'FocusEvent', relatedTarget: null, force: true });

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');

    cy
      .focused()
      .trigger('focusin', { eventConstructor: 'FocusEvent', relatedTarget: null, force: true });

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');

    cy.press(Cypress.Keyboard.Keys.ESC);

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');

    cy
      .get('.js-minimize-menu')
      .should('be.focused');

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should($target => {
        expect($target[0].closest('.app-nav')).to.be.null;
      });

    cy
      .get('.app-nav__bottom .js-nav-menu')
      .should('be.visible')
      .focus();

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-minimize-menu');

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');

    cy.press(Cypress.Keyboard.Keys.SPACE);

    cy
      .get('.app-nav')
      .should('not.have.class', 'app-nav--minimized');
  });
});
