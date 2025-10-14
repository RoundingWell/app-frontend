import { v5 as uuid } from 'uuid';
import Radio from 'backbone.radio';
import { RWELL_NS } from 'js/static';
import DialerService from './dialer';

context('Dialer Service', function() {
  beforeEach(function() {
    cy
      .clock()
      .mount(rootView => {
        const region = rootView.getRegion('overlay');
        new DialerService({ region });

        return '<div></div>';
      })
      .as('root');
  });

  specify('five9CallComplete', function() {
    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: {
          data: {},
        },
      })
      .as('patchArtifact');

    cy
      .get('@root')
      .then(() => {
        Radio.request('dialer', 'five9CallComplete', 'abc1234', {
          callDuration: 42,
          disposition: 'completed',
        });
      });

    cy
      .wait('@patchArtifact')
      .its('request.body')
      .should('deep.equal', {
        data: {
          type: 'artifacts',
          id: uuid('five9-call-log:abc1234', RWELL_NS),
          attributes: {
            artifact: 'five9-call-log',
            identifier: 'abc1234',
            values: {
              callDuration: 42,
              disposition: 'completed',
            },
          },
        },
      });
  });
});
