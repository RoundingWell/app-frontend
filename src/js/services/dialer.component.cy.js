import { v5 as uuid } from 'uuid';
import { Application, Radio, View } from 'marionette';
import { EIGHTBYEIGHT_CTI_URL } from '@roundingwell/care-ops-8x8/eightbyeight_constants.js';
import { RWELL_NS } from 'js/static';
import DialerService from './dialer';

context('Dialer Service', function() {
  let service;

  beforeEach(function() {
    cy
      .clock()
      .mount(rootView => {
        const region = rootView.getRegion('overlay');
        service = new DialerService({ region });

        return new View({ template: false });
      })
      .as('root');
  });

  afterEach(async function() {
    Radio.stopReplying('settings', 'get');

    if (Radio.request.restore) {
      Radio.request.restore();
    }

    if (service) {
      await service.destroy();
      service = null;
    }
  });

  specify('does not create a provider for an unknown dialer setting', function() {
    Radio.reply('settings', 'get', () => 'unknown');

    cy.then(async() => {
      await service.start();

      expect(service.isRunning()).to.equal(true);
      expect(service.hasChildApp('provider')).to.equal(false);
    });
  });

  specify('delivers the latest queued call before and after stopping', function() {
    const call = cy.stub();
    const action = { id: 'action-1' };
    const DialerApp = Application.extend({ call });

    Radio.reply('settings', 'get', () => 'ringcentral');
    cy.stub(service, 'loadProvider').resolves({ DialerApp });

    cy.then(async() => {
      service.call('15555550100', action);
      service.call('15555550101', action);
      await service.start();

      expect(call).to.have.been.calledOnceWithExactly('15555550101', action);

      service.stop();
      service.call('15555550102', action);
      await service.start();

      expect(call).to.have.been.calledTwice;
      expect(call.lastCall.args).to.deep.equal(['15555550102', action]);
    });
  });

  specify('five9Call', function() {
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
        Radio.request('dialer', 'five9Call', {
          callData: {
            interactionId: 'abc1234',
          },
          callLogData: {
            callDuration: 42,
            disposition: 'completed',
          },
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
              callData: {
                interactionId: 'abc1234',
              },
              callLogData: {
                callDuration: 42,
                disposition: 'completed',
              },
            },
          },
        },
      });
  });

  specify('eightByEightCall', function() {
    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy
      .get('@root')
      .then(() => {
        Radio.request('dialer', 'eightByEightCall', {
          callData: {
            eventId: 'abc1234',
            searchContext: '+15555550100',
            callRecording: 'https://cloud8.8x8.com/recording/abc1234',
          },
          actionId: 'action-1',
        });
      });

    cy
      .wait('@patchArtifact')
      .its('request.body')
      .should('deep.equal', {
        data: {
          type: 'artifacts',
          id: uuid('8x8-call-log:abc1234', RWELL_NS),
          attributes: {
            artifact: '8x8-call-log',
            identifier: 'abc1234',
            values: {
              callData: {
                eventId: 'abc1234',
                searchContext: '+15555550100',
              },
              actionId: 'action-1',
            },
          },
        },
      });
  });

  specify('loads the 8x8 provider', function() {
    Radio.reply('settings', 'get', () => '8x8');

    cy.then(async() => {
      await service.start();

      const wrapper = document.querySelector('.eightbyeight-wrapper');
      const iframe = wrapper && wrapper.querySelector('iframe');

      expect(service.isRunning()).to.equal(true);
      expect(service.hasChildApp('provider')).to.equal(true);
      expect(wrapper).to.exist;
      expect(iframe.getAttribute('src')).to.equal(EIGHTBYEIGHT_CTI_URL);
    });
  });

  specify('ringcentralCall', function() {
    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy
      .get('@root')
      .then(() => {
        Radio.request('dialer', 'ringcentralCall', {
          callData: {
            callId: 'abc1234',
          },
        });
      });

    cy
      .wait('@patchArtifact')
      .its('request.body')
      .should('deep.equal', {
        data: {
          type: 'artifacts',
          id: uuid('ringcentral-call-log:abc1234', RWELL_NS),
          attributes: {
            artifact: 'ringcentral-call-log',
            identifier: 'abc1234',
            values: {
              callData: {
                callId: 'abc1234',
              },
            },
          },
        },
      });
  });

  specify('showPatientLinks ignores invalid phone numbers', function() {
    const fetchSearch = cy.stub().as('fetchSearch');
    const request = Radio.request;

    cy.stub(Radio, 'request').callsFake((channelName, requestName, ...args) => {
      if (channelName === 'entities' && requestName === 'actions:model') {
        return {
          getPatient() {
            return null;
          },
        };
      }

      if (channelName === 'entities' && requestName === 'searchPatients:collection') {
        return {
          fetch: fetchSearch,
          each() {},
        };
      }

      return request.call(Radio, channelName, requestName, ...args);
    });

    cy.then(() => {
      service.showPatientLinks({
        actionId: 'action-1',
        number: '123',
      });
    });

    cy
      .get('@fetchSearch')
      .should('not.have.been.called');
  });
});
