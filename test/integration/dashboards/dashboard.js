import { v4 as uuid } from 'uuid';

import { getErrors } from 'helpers/json-api';

import { getDashboard } from 'support/api/dashboards';

context('dashboard', function() {
  specify('display dashboard', function() {
    const testDashboard = getDashboard({
      attributes: { name: 'Test Dashboard' },
    });

    cy
      .routeDashboards()
      .routeDashboard(fx => {
        fx.data = testDashboard;

        return fx;
      })
      .intercept('GET', 'https://*.quicksight.aws.amazon.com/**', req => {
        req.reply('<html><body class="test-iframe-content">Test Iframe Content</body></html>');
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
