import { v7 as uuid } from 'uuid';

import { getErrors } from 'helpers/json-api';

import { getDashboard, getGuestToken, getSupersetDashboard, SUPERSET_DOMAIN } from 'support/api/dashboards';

context('dashboard', function() {
  specify('display dashboard', function() {
    const testDashboard = getDashboard({
      attributes: { name: 'Test Dashboard' },
    });

    cy
      .routeDashboards(fx => {
        fx.data = [testDashboard];

        return fx;
      })
      .routeDashboard(fx => {
        fx.data = testDashboard;

        return fx;
      })
      .intercept('GET', 'https://*.quicksight.aws.amazon.com/**', req => {
        req.reply('<html><body>Test Iframe Content</body></html>');
      })
      .visit(`/dashboards/${ testDashboard.id }`)
      .wait('@routeDashboard');

    cy
      .get('.dashboard__frame')
      .find('.dashboard__context-trail')
      .should('contain', 'Test Dashboard');

    cy
      .get('.dashboard__frame')
      .find('.dashboard__iframe iframe')
      .should('have.attr', 'src')
      .and('include', `https://us-west-2.quicksight.aws.amazon.com/embed/embed_id/dashboards/${ testDashboard.id }?`);

    cy
      .get('.dashboard__frame')
      .find('.dashboard__context-trail .js-back')
      .click();

    cy
      .url()
      .should('not.contain', `dashboards/${ testDashboard.id }`)
      .should('contain', 'dashboards');

    cy
      .get('.card-list')
      .find('.card-list__item')
      .first()
      .click();

    // dashboard loaded using cached aws sdk embedding context
    cy
      .get('.dashboard__frame')
      .find('.dashboard__iframe iframe')
      .should('have.attr', 'src')
      .and('include', `https://us-west-2.quicksight.aws.amazon.com/embed/embed_id/dashboards/${ testDashboard.id }?`);
  });

  specify('superset dashboards render and refresh expiring guest tokens', function() {
    cy.then(() => {
      const testDashboard = getSupersetDashboard({
        attributes: { name: 'Superset Dashboard' },
      });

      cy
        .routeDashboards(fx => {
          fx.data = [testDashboard];

          return fx;
        })
        .routeDashboard(fx => {
          fx.data = testDashboard;

          return fx;
        })
        .routeDashboardGuestToken()
        .routeSupersetEmbed()
        .visit(`/dashboards/${ testDashboard.id }`)
        .wait('@routeDashboard');

      cy
        .get('.dashboard__frame')
        .find('.dashboard__context-trail')
        .should('contain', 'Superset Dashboard');

      cy
        .get('.dashboard__frame')
        .find('.dashboard__iframe iframe')
        .should('have.attr', 'src')
        .and('include', `${ SUPERSET_DOMAIN }/embedded/${ testDashboard.id }`);

      // The dashboard fetch supplies the first token, so the embed does not mint another
      cy
        .get('@routeDashboardGuestToken.all')
        .should('have.length', 0);
    });

    cy.then(() => {
      const testDashboard = getSupersetDashboard({
        attributes: { guest_token: getGuestToken({ expiresIn: 10 }) },
      });

      cy
        .routeDashboards(fx => {
          fx.data = [testDashboard];

          return fx;
        })
        .routeDashboard(fx => {
          fx.data = testDashboard;

          return fx;
        })
        .routeDashboardGuestToken(getGuestToken({ expiresIn: 10 }))
        .routeSupersetEmbed()
        .visit(`/dashboards/${ testDashboard.id }`)
        .wait('@routeDashboard');

      cy
        .wait('@routeDashboardGuestToken', { timeout: 15000 });

      cy
        .get('.dashboard__frame')
        .find('.dashboard__context-trail .js-back')
        .click();

      // A dashboard that is no longer displayed stops refreshing its token
      cy
        .wait(8000)
        .get('@routeDashboardGuestToken.all')
        .should('have.length', 1);
    });
  });

  specify('dashboard does not exist', function() {
    const testUuid = uuid();

    cy
      .routeDashboards()
      .intercept('GET', `/api/dashboards/${ testUuid }`, {
        statusCode: 404,
        body: {
          errors: getErrors({
            status: '404',
            title: 'Not Found',
            detail: 'Cannot find dashboard',
          }),
        },
      })
      .as('routeDashboard404')
      .visit(`/dashboards/${ testUuid }`)
      .wait('@routeDashboard404');

    cy
      .url()
      .should('not.contain', `dashboards/${ testUuid }`)
      .should('contain', 'dashboards');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Dashboard you requested does not exist.');
  });
});
