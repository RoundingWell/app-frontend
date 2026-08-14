import { getDashboard } from 'support/api/dashboards';

context('dashboards all list', function() {
  specify('display dashboards list', function() {
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

  specify('empty dashboards list', function() {
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

  specify('find in list', function() {
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
  });
});
