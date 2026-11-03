import { v5 as uuid } from 'uuid';
import { Application, Radio, View } from 'marionette';
import { COPY_NUMBER_UNTIL_WHITELISTED } from '@roundingwell/care-ops-8x8/eightbyeight_app.js';
import { RWELL_NS } from 'js/static';
import AlertService from 'js/services/alert';
import DialerService from './dialer';

context('Dialer Service', function() {
  let service;
  let rootView;
  let alertService;

  beforeEach(function() {
    cy
      .clock()
      .mount(view => {
        rootView = view;
        const region = rootView.getRegion('overlay');
        service = new DialerService({ region });

        return new View({ template: false });
      })
      .as('root');
  });

  afterEach(async function() {
    COPY_NUMBER_UNTIL_WHITELISTED.enabled = true;
    Radio.stopReplying('settings', 'get');

    if (Radio.request.restore) {
      Radio.request.restore();
    }

    if (alertService) {
      await alertService.destroy();
      alertService = null;
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

  specify('loads the 8x8 provider with softphone permissions', function() {
    Radio.reply('settings', 'get', () => '8x8');

    cy.then(async() => {
      await service.start();

      expect(service.isRunning()).to.equal(true);
      expect(service.hasChildApp('provider')).to.equal(true);
    });

    cy
      .get('.eightbyeight-wrapper iframe')
      .should('have.attr', 'allow', 'microphone *; camera *; speaker-selection *; hid *; local-network-access *; autoplay *')
      .and('not.have.attr', 'sandbox');
  });

  specify('copies a clicked 8x8 number and still sends startCall', function() {
    const writeText = cy.stub().resolves();

    startEightByEightDialer();
    stubClipboard(writeText);
    readyEightByEightCall();

    cy
      .get('@root')
      .then(() => {
        Radio.request('dialer', 'call', '+15555550100', { id: 'action-1' });
      });

    cy
      .get('.eightbyeight-wrapper')
      .should('have.class', 'is-open');

    cy
      .get('.alert-box')
      .should('contain', 'Number copied — paste it into the 8x8 panel and press Call.')
      .and('not.contain', '+15555550100');

    cy.then(() => {
      expect(writeText).to.be.calledOnceWithExactly('+15555550100');
    });

    cy
      .get('@startCalls')
      .should(calls => {
        const [message, origin] = calls[0];

        expect(calls).to.have.length(1);
        expect(origin).to.equal('https://cloud8.8x8.com');
        expect(message.content).to.include({
          eventName: 'startCall',
          method: 'mapDirective',
          phoneNumber: '+15555550100',
        });
      });
  });

  specify('shows the number when the 8x8 clipboard copy fails', function() {
    const writeText = cy.stub().rejects(new Error('denied'));

    startEightByEightDialer();
    stubClipboard(writeText);
    readyEightByEightCall();

    cy
      .get('@root')
      .then(() => {
        Radio.request('dialer', 'call', '+15555550100', { id: 'action-1' });
      });

    cy
      .get('.alert-box')
      .should('contain', 'Couldn\'t copy the number. Type +15555550100 into the 8x8 panel and press Call.');

    cy
      .get('@startCalls')
      .should('have.length', 1);
  });

  specify('skips the 8x8 clipboard fallback when it is disabled', function() {
    const writeText = cy.stub().resolves();
    COPY_NUMBER_UNTIL_WHITELISTED.enabled = false;

    startEightByEightDialer();
    stubClipboard(writeText);
    readyEightByEightCall();

    cy
      .get('@root')
      .then(() => {
        Radio.request('dialer', 'call', '+15555550100', { id: 'action-1' });
      });

    cy
      .get('.alert-box')
      .should('not.exist');

    cy.then(() => {
      expect(writeText).not.to.be.called;
    });

    cy
      .get('@startCalls')
      .should('have.length', 1);
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

  function startEightByEightDialer() {
    Radio.reply('settings', 'get', () => '8x8');

    cy.then(async() => {
      await service.start();
      alertService = new AlertService({ region: rootView.getRegion('alert') });
    });
  }

  function stubClipboard(writeText) {
    cy.window().then(win => {
      Object.defineProperty(win.navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
    });
  }

  function readyEightByEightCall() {
    cy
      .get('.eightbyeight-wrapper iframe')
      .then($iframe => {
        const frameWindow = $iframe[0].contentWindow;
        const calls = [];
        frameWindow.postMessage = (...args) => {
          calls.push(args);
        };
        cy.wrap(calls).as('startCalls');
        $iframe[0].dispatchEvent(new Event('load'));
      });
  }
});
