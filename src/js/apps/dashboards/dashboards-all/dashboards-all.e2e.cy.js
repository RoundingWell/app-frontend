import { getDashboard } from 'support/api/dashboards';

context('dashboards all list', function() {
  specify('open, search, and load empty dashboard lists', function() {
    cy.then(() => {
      cy.log('display dashboards list');
      cy.viewport(2200, 900);

      const testDashboards = [
        getDashboard({
          attributes: { name: 'Daily Dashboard' },
        }),
        getDashboard({
          attributes: { name: 'Weekly Dashboard' },
        }),
        getDashboard({
          attributes: { name: 'Monthly Dashboard' },
        }),
      ];

      cy
        .routeDashboards(fx => {
          fx.data = testDashboards;

          return fx;
        })
        .routeDashboard(fx => {
          fx.data = testDashboards[2];

          return fx;
        })
        .intercept('GET', 'https://*.quicksight.aws.amazon.com/**', req => {
          req.reply('<html><body>Test Iframe Content</body></html>');
        })
        .visit('/dashboards')
        .wait('@routeDashboards');

      cy
        .get('.card-list')
        .find('.card-list__item')
        .first()
        .should('contain', 'Daily Dashboard')
        .next()
        .should('contain', 'Weekly Dashboard')
        .next()
        .should('contain', 'Monthly Dashboard')
        .click()
        .wait('@routeDashboard');

      cy
        .url()
        .should('contain', `dashboards/${ testDashboards[2].id }`);
    });

    cy.then(() => {
      cy.log('find in list');
      const testDashboards = [
        getDashboard({
          attributes: { name: 'Daily Dashboards' },
        }),
        getDashboard({
          attributes: { name: 'Weekly Dashboard' },
        }),
      ];

      cy
        .routeDashboards(fx => {
          fx.data = testDashboards;

          return fx;
        })
        .routeDashboard(fx => {
          fx.data = testDashboards[0];

          return fx;
        })
        .intercept('GET', 'https://*.quicksight.aws.amazon.com/**', req => {
          req.reply('<html><body>Test Iframe Content</body></html>');
        })
        .visit('/dashboards')
        .wait('@routeDashboards');

      cy
        .get('.list-page__header')
        .find('[data-search-region] .js-input')
        .as('listSearch')
        .type('abc');

      cy
        .get('.list-page__header')
        .find('[data-search-region] .list-search__container')
        .should('have.class', 'is-applied');

      cy
        .get('.card-list')
        .as('dashboardList')
        .find('.card-list__empty')
        .should('contain', 'No results match your Find in List search');

      cy
        .get('@listSearch')
        .next()
        .should('have.class', 'js-clear')
        .click();

      cy
        .get('.list-page__header')
        .find('[data-search-region] .list-search__container')
        .should('not.have.class', 'is-applied');

      cy
        .get('@dashboardList')
        .find('.card-list__item')
        .should('have.length', 2);

      cy
        .get('@listSearch')
        .next()
        .should('not.be.visible');

      cy
        .get('@listSearch')
        .type('daily');

      cy
        .get('@dashboardList')
        .find('.card-list__item')
        .should('have.length', 1)
        .first()
        .should('contain', 'Daily Dashboards')
        .click()
        .wait('@routeDashboard');

      cy
        .go('back')
        .wait('@routeDashboards');

      cy
        .get('@listSearch')
        .should('have.attr', 'value', 'daily');

      cy
        .get('@dashboardList')
        .find('.card-list__item')
        .should('have.length', 1)
        .first()
        .should('contain', 'Daily Dashboards');

      cy.then(() => {
        const label = 'Dashboards';
        const url = '/api/dashboards*';
        cy.routesForDefault().visit('/worklist/owned-by').wait('@routeActions');
        cy.intercept('GET', url, { statusCode: 400, body: {} }).as('failedRoute');

        cy.get('.app-nav__link').contains(label).click();

        cy.wait('@failedRoute');
        cy.get('.error-page').should('contain', 'Error code: 400.');
        cy.get('.error-page').contains('Back to Your Workspace').click();
        cy.location('pathname').should('equal', '/one/worklist/owned-by');
        cy.get('.worklist-list__list').should('be.visible');
        cy.get('.error-page').should('not.exist');
      });
    });

    cy.then(() => {
      cy.log('empty dashboards list');
      cy
        .routeDashboards(fx => {
          fx.data = [];

          return fx;
        })
        .routeDashboard()
        .visit('/dashboards')
        .wait('@routeDashboards');

      cy
        .get('.card-list__empty')
        .contains('No Dashboards');
    });
  });
});
