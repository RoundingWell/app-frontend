import Radio from 'backbone.radio';

import AlertService from './alert';

context('Alert Service', function() {
  let alertService;

  beforeEach(function() {
    cy
      .clock()
      .mount(rootView => {
        const region = rootView.getRegion('alert');
        alertService = new AlertService({ region });

        return '<style>.alert-box{ opacity:1!important; }</style>';
      })
      .as('root');
  });

  afterEach(function() {
    if (alertService) {
      alertService.destroy();
      alertService = null;
    }

    Radio.channel('alert').reset();
  });

  specify('Displaying', function() {
    cy
      .get('@root')
      .then(() => {
        Radio.request('alert', 'show:info', 'info');
      })
      .find('.alert-box')
      .contains('info');

    cy
      .get('@root')
      .then(() => {
        Radio.request('alert', 'show:info', 'error');
      })
      .find('.alert-box')
      .contains('error')
      .tick(4900);

    cy
      .get('@root')
      .then(() => {
        Radio.request('alert', 'show:apiError', {
          errors: [
            {
              detail: 'API error 1',
            },
            {
              detail: 'API error 2',
            },
          ],
        });
      })
      .find('.alert-box')
      .first()
      .should('contain', 'API error 1')
      .next()
      .should('contain', 'API error 2');

    cy
      .get('@root')
      .then(() => {
        Radio.request('alert', 'show:success', 'success');
      })
      .find('.alert-box')
      .contains('success')
      .tick(4900);

    cy
      .get('.alert-box')
      .should('not.exist');
  });

  specify('Closing via dismiss button', function() {
    const onComplete = cy.stub();

    cy
      .get('@root')
      .then(() => {
        Radio.request('alert', 'show:undo', { onComplete });
      })
      .find('.js-dismiss')
      .click()
      .click()
      .then(() => {
        expect(onComplete).to.be.calledOnce;
      })
      .tick(1000);

    cy
      .get('@root')
      .find('.alert-box')
      .should('not.exist');
  });

  specify('Closing via undo button', function() {
    const onUndo = cy.stub();

    cy
      .get('@root')
      .then(() => {
        Radio.request('alert', 'show:undo', { onUndo });
      })
      .find('.js-undo')
      .click()
      .click()
      .then(() => {
        expect(onUndo).to.be.calledOnce;
      })
      .tick(1000);

    cy
      .get('@root')
      .find('.alert-box')
      .should('not.exist');
  });
});
