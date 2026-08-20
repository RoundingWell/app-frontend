import { getErrors } from 'helpers/json-api';

context('Global Error Page', function() {
  beforeEach(function() {
    cy.routesForDefault();
  });

  specify('404 not found', function() {
    cy
      .viewport(390, 640)
      .visit('/route-does-not-exist');

    cy
      .get('.error-page')
      .should('have.attr', 'role', 'main')
      .and('have.attr', 'aria-labelledby', 'global-error-title')
      .and('be.focused')
      .should('contain', 'Something went wrong.')
      .and('contain', ' This page doesn\'t exist.')
      .then($page => {
        const page = $page[0].getBoundingClientRect();

        expect(page.left).to.be.at.least(0);
        expect(page.right).to.be.at.most(390);
      });

    cy
      .get('#global-error-title')
      .should('match', 'h1');

    cy
      .get('.error-page__recovery')
      .should($button => {
        expect($button[0].getBoundingClientRect().height).to.be.at.least(44);
      });

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .get('.error-page')
      .should('not.exist');
  });

  specify('404 not found - root routes', function() {
    cy
      .visit('/route-does-not-exist', { isRoot: true });

    cy
      .get('.error-page')
      .should('contain', 'Something went wrong.')
      .and('contain', ' This page doesn\'t exist.');

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .get('.error-page')
      .should('not.exist');
  });

  specify('401 token error keeps the current workspace route', function() {
    cy
      .intercept('GET', '/api/clinicians/me', {
        statusCode: 401,
        body: {
          errors: getErrors({
            status: '401',
            code: '4400',
            title: 'Unauthorized',
            detail: 'Access token is required',
          }),
        },
      })
      .as('routeCurrentClinician')
      .visit({ noWait: true });

    cy
      .wait('@routeCurrentClinician');

    cy
      .url()
      .should('contain', '/one/');
  });

  specify('non-json bootstrap error', function() {
    cy
      .intercept('GET', '/api/clinicians/me', {
        statusCode: 403,
        body: '<html><body>403 Forbidden</body></html>',
      })
      .as('routeCurrentClinician')
      .visit({ noWait: true })
      .wait('@routeCurrentClinician');

    cy
      .get('.startup__error')
      .should('be.visible')
      .and('contain', 'We couldn\'t load your workspace')
      .and('contain', 'Check your connection, then try again.');
  });

  specify('workspace error', function() {
    cy.on('uncaught:exception', () => {
      return false;
    });

    cy
      .intercept('GET', '/api/states', {
        statusCode: 500,
        body: {},
      })
      .as('routeStates')
      .visit({ noWait: true })
      .wait('@routeStates');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');
  });

  specify('500 error', function() {
    const errorStub = cy.stub();

    cy.on('uncaught:exception', () => {
      errorStub();

      return false;
    });

    cy
      .intercept('GET', '/api/workspaces/**/clinicians*', {
        statusCode: 500,
        body: {},
      })
      .as('routeWorkspaceClinicians')
      .visit();

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');

    cy.routeStates();

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .get('.error-page')
      .should('not.exist')
      .then(() => {
        expect(errorStub).to.be.calledOnce;
      });
  });
});
