import dayjs from 'dayjs';
import { v5 as uuid } from 'uuid';
import { Application, Radio, View } from 'marionette';
import { COPY_NUMBER_UNTIL_WHITELISTED } from '@roundingwell/care-ops-8x8/eightbyeight_app.js';
import { CALL_ATTACH_WINDOW_MS } from '@roundingwell/care-ops-8x8/eightbyeight_call_log.js';
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
    Radio.trigger('dialer', 'change:currentAction', null);
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

  // Layout-viewport heights after typical browser chrome. Scaled sizes are
  // the CSS pixels of 1366x768 and 1280x720 at 125% and 150% display scaling.
  const shortViewports = [
    [1366, 648],
    [1280, 600],
    [1092, 494],
    [910, 392],
    [1024, 456],
    [852, 360],
  ];

  specify('keeps the open 8x8 panel inside a short viewport', function() {
    startEightByEightDialer();

    cy.viewport(1280, 500);

    // The collapsed bar is fixed to the viewport edge. Dispatch the click on
    // the header the clinician uses; Cypress's actionability check treats
    // that edge as covered in the component runner.
    cy
      .get('.eightbyeight-panel__header')
      .then($header => {
        $header[0].click();
      });

    cy
      .get('.eightbyeight-wrapper')
      .should('have.class', 'is-open');

    shortViewports.forEach(([width, height]) => {
      cy.viewport(width, height);

      cy
        .get('.eightbyeight-wrapper')
        .should($wrapper => {
          const rect = $wrapper[0].getBoundingClientRect();

          expect(rect.top, `top at ${ width }x${ height }`).to.be.at.least(0);
          expect(rect.left, `left at ${ width }x${ height }`).to.be.at.least(0);
          expect(rect.bottom, `bottom at ${ width }x${ height }`).to.be.at.most(window.innerHeight + 1);
          expect(rect.right, `right at ${ width }x${ height }`).to.be.at.most(window.innerWidth + 1);
        });

      cy
        .get('.eightbyeight-panel')
        .should($panel => {
          const panel = $panel[0];
          const iframe = panel.querySelector('iframe');

          expect(iframe.offsetHeight, `iframe at ${ width }x${ height }`).to.be.at.least(720);
          expect(panel.scrollHeight, `scroll at ${ width }x${ height }`).to.be.greaterThan(panel.clientHeight);
        });
    });

    cy.viewport(1280, 768);
  });

  function postInboundOffer() {
    postEightByEightEvent('mashell-voice-phone-offered-uc-event-v1', {
      eventName: 'offered',
      eventId: 'offered-in',
      method: 'mapEvent',
      direction: 'inbound',
      media: 'phone',
      schemaVersion: '1.0.0',
    });
  }

  specify('opens the 8x8 panel for an inbound call without reloading it', function() {
    startEightByEightDialer();
    cy.viewport(1280, 500);

    cy
      .get('.eightbyeight-panel__iframe')
      .then($iframe => {
        cy.wrap($iframe[0]).as('dialerFrame');
      });

    cy
      .get('.eightbyeight-wrapper')
      .should('not.have.class', 'is-open');

    postInboundOffer();

    cy
      .get('.eightbyeight-wrapper')
      .should('have.class', 'is-open');

    cy
      .get('@dialerFrame')
      .should($frame => {
        const frame = $frame[0];

        expect(frame.isConnected).to.equal(true);
        expect(document.querySelector('.eightbyeight-panel__iframe')).to.equal(frame);
        expect(frame.src).to.contain('mashell/public/index.html');
        expect(frame.hasAttribute('sandbox')).to.equal(false);
        expect(getComputedStyle(frame).pointerEvents).to.equal('auto');
        expect(getComputedStyle(frame).visibility).to.equal('visible');
      });

    cy
      .get('.eightbyeight-panel__header')
      .then($header => {
        cy
          .get('.eightbyeight-panel__iframe')
          .should($iframe => {
            const headerBox = $header[0].getBoundingClientRect();
            const frameBox = $iframe[0].getBoundingClientRect();

            expect(frameBox.top).to.be.at.least(headerBox.bottom - 1);
          });
      });

    cy
      .get('.eightbyeight-panel')
      .then($panel => {
        $panel[0].scrollTop = 200;
      });

    cy
      .get('.eightbyeight-panel')
      .should($panel => {
        expect($panel[0].scrollTop).to.equal(200);
      });

    postInboundOffer();

    cy
      .get('.eightbyeight-panel')
      .should($panel => {
        expect($panel[0].scrollTop).to.equal(0);
      });

    cy.viewport(1280, 768);
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

  specify('saves one 8x8 call log when the call ends', function() {
    const startTime = '1793723417987';
    const answeredTime = '1793723420000';
    const endTime = '1793723427938';
    const request = Radio.request;

    cy.stub(Radio, 'request').callsFake((channelName, requestName, ...args) => {
      if (channelName === 'entities' && requestName === 'actions:model') {
        return {
          getPatient() {
            return {
              id: 'patient-1',
              get(key) {
                return { first_name: 'Test', last_name: 'Patient' }[key];
              },
            };
          },
        };
      }

      return request.call(Radio, channelName, requestName, ...args);
    });

    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    clickToCall('+15555550100', 'action-1', Number(startTime));

    postEightByEightEvent('mashell-voice-phone-offered-uc-event-v1', {
      eventName: 'offered',
      eventId: 'offered-1',
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext: '+15555550100',
      startTime,
      schemaVersion: '1.0.0',
    });

    postEightByEightEvent('mashell-voice-phone-accepted-uc-event-v1', {
      eventName: 'accepted',
      eventId: 'accepted-1',
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext: '+15555550100',
      startTime: answeredTime,
      schemaVersion: '1.0.0',
    });

    postEightByEightEvent('mashell-voice-phone-terminated-uc-event-v1', {
      eventName: 'terminated',
      eventId: 'abc1234',
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext: '+15555550100',
      startTime,
      endTime,
      callDuration: '00:00:10',
      hasRecording: true,
      schemaVersion: '1.0.0',
    });

    cy
      .wait('@patchArtifact')
      .its('request.body')
      .should(body => {
        const startIso = dayjs(Number(startTime)).toISOString();
        const endIso = dayjs(Number(endTime)).toISOString();

        expect(body).to.deep.equal({
          data: {
            type: 'artifacts',
            id: uuid('8x8-call-log:abc1234', RWELL_NS),
            attributes: {
              artifact: '8x8-call-log',
              identifier: 'abc1234',
              values: {
                callData: {
                  eventId: 'abc1234',
                  eventName: 'terminated',
                  media: 'phone',
                  method: 'mapEvent',
                  schemaVersion: '1.0.0',
                  direction: 'outbound',
                  searchContext: '+15555550100',
                  callDuration: '0:00:10',
                  startTime: startIso,
                  endTime: endIso,
                  hasRecording: true,
                },
                report: {
                  Call_ID: 'abc1234',
                  Direction: 'Outgoing',
                  Talk_Time: '0:00:10',
                  Start_Time: startIso,
                  Stop_Time: endIso,
                  Answered: 'Answered',
                  Last_Leg_Disposition: 'Connected',
                  Callee: '+15555550100',
                },
                action_id: 'action-1',
                patient_id: 'patient-1',
              },
            },
          },
        });
      });
  });

  specify('does not attach an 8x8 call for a different number', function() {
    const startTime = '1793723417987';

    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    clickToCall('+15555550100', 'action-1', Number(startTime));

    postTerminatedCall({
      eventId: 'other-number',
      searchContext: '+15555550999',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.action_id).to.equal(null);
        expect(values.patient_id).to.equal(null);
        expect(values.callData.searchContext).to.equal('+15555550999');
      });
  });

  specify('does not attach an 8x8 call that starts outside the click window', function() {
    const startTime = '1793723417987';

    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    clickToCall('+15555550100', 'action-1', Number(startTime) - CALL_ATTACH_WINDOW_MS - 1);

    postTerminatedCall({
      eventId: 'late-call',
      searchContext: '+15555550100',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.action_id).to.equal(null);
        expect(values.patient_id).to.equal(null);
      });
  });

  specify('does not reuse an 8x8 action after it is attached', function() {
    const startTime = '1793723417987';

    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    clickToCall('+15555550100', 'action-1', Number(startTime));

    postTerminatedCall({
      eventId: 'first-call',
      searchContext: '+15555550100',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values.action_id')
      .should('equal', 'action-1');

    postTerminatedCall({
      eventId: 'second-call',
      searchContext: '+15555550100',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.callData.eventId).to.equal('second-call');
        expect(values.action_id).to.equal(null);
        expect(values.patient_id).to.equal(null);
      });
  });

  specify('does not copy a number during an active 8x8 call', function() {
    const writeText = cy.stub().resolves();
    const request = Radio.request;

    cy.stub(Radio, 'request').callsFake((channelName, requestName, ...args) => {
      if (channelName === 'entities' && requestName === 'actions:model') {
        return {
          getPatient() {
            return {
              id: 'patient-1',
              get() {
                return 'Test';
              },
            };
          },
        };
      }

      return request.call(Radio, channelName, requestName, ...args);
    });

    Radio.reply('settings', 'get', () => '8x8');

    cy.then(async() => {
      await service.start();
      alertService = new AlertService({ region: rootView.getRegion('alert') });
    });

    stubClipboard(writeText);

    postEightByEightEvent('mashell-voice-phone-accepted-uc-event-v1', {
      eventName: 'accepted',
      eventId: 'accepted-1',
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext: '+15555550100',
      startTime: '1793723420000',
      schemaVersion: '1.0.0',
    });

    cy.then(() => {
      Radio.request('dialer', 'call', '+15555550999', { id: 'action-2' });
    });

    cy
      .get('.eightbyeight-wrapper')
      .should('have.class', 'is-open');

    cy
      .get('.alert-box')
      .should('not.exist');

    cy.then(() => {
      expect(writeText).not.to.be.called;
    });
  });

  specify('keeps an in-progress 8x8 call when another number hangs up', function() {
    const firstStart = '1793723417987';
    const otherStart = '1793723500000';
    const firstEnd = '1793723600000';

    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    postEightByEightEvent('mashell-voice-phone-offered-uc-event-v1', {
      eventName: 'offered',
      eventId: 'offered-a',
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext: '+15555550100',
      startTime: firstStart,
      schemaVersion: '1.0.0',
    });

    postTerminatedCall({
      eventId: 'other-hangup',
      searchContext: '+15555550999',
      startTime: otherStart,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values.callData')
      .should(callData => {
        expect(callData.eventId).to.equal('other-hangup');
        expect(callData.startTime).to.equal(dayjs(Number(otherStart)).toISOString());
        expect(callData.searchContext).to.equal('+15555550999');
      });

    postTerminatedCall({
      eventId: 'first-hangup',
      searchContext: '+15555550100',
      startTime: firstEnd,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values.callData')
      .should(callData => {
        expect(callData.eventId).to.equal('first-hangup');
        expect(callData.startTime).to.equal(dayjs(Number(firstStart)).toISOString());
      });
  });

  specify('drops an in-progress 8x8 call when the provider stops', function() {
    const offeredStart = '1793723417987';
    const endedStart = '1793723500000';

    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    postEightByEightEvent('mashell-voice-phone-offered-uc-event-v1', {
      eventName: 'offered',
      eventId: 'offered-stale',
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext: '+15555550100',
      startTime: offeredStart,
      schemaVersion: '1.0.0',
    });

    cy.then(async() => {
      await service.stop();
      await service.start();
    });

    postTerminatedCall({
      eventId: 'after-stop',
      searchContext: '+15555550100',
      startTime: endedStart,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values.callData.startTime')
      .should('equal', dayjs(Number(endedStart)).toISOString());
  });

  specify('attaches a manual 8x8 call when the number is on the open action', function() {
    const startTime = '1793723417987';

    stubPatientPhones([{ number: '(555) 555-0100' }]);
    Radio.trigger('dialer', 'change:currentAction', { id: 'action-1', patientId: 'patient-1' });
    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    postManualCall({
      eventId: 'manual-match',
      searchContext: '+15555550100',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.action_id).to.equal('action-1');
        expect(values.patient_id).to.equal('patient-1');
      });
  });

  specify('does not attach a manual 8x8 call for a different patient number', function() {
    const startTime = '1793723417987';

    stubPatientPhones([{ number: '+15555550999' }]);
    Radio.trigger('dialer', 'change:currentAction', { id: 'action-1', patientId: 'patient-1' });
    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    postManualCall({
      eventId: 'manual-miss',
      searchContext: '+15555550100',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.action_id).to.equal(null);
        expect(values.patient_id).to.equal(null);
      });
  });

  specify('does not attach a manual 8x8 call when no action is open', function() {
    const startTime = '1793723417987';

    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    postManualCall({
      eventId: 'manual-none',
      searchContext: '+15555550100',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.action_id).to.equal(null);
        expect(values.patient_id).to.equal(null);
      });
  });

  specify('prefers a pending Call Number click over the open action', function() {
    const startTime = '1793723417987';
    const request = Radio.request;

    cy.stub(Radio, 'request').callsFake((channelName, requestName, ...args) => {
      if (channelName === 'entities' && requestName === 'patientFields:model') {
        return {
          value: [{ number: '+15555550100' }],
          get(key) {
            return this[key];
          },
          fetch() {
            return Promise.resolve();
          },
        };
      }

      if (channelName === 'entities' && requestName === 'actions:model') {
        return {
          getPatient() {
            return {
              id: 'patient-click',
              get() {
                return 'Test';
              },
            };
          },
        };
      }

      return request.call(Radio, channelName, requestName, ...args);
    });

    Radio.trigger('dialer', 'change:currentAction', { id: 'action-open', patientId: 'patient-open' });
    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    clickToCall('+15555550100', 'action-click', Number(startTime));

    postManualCall({
      eventId: 'clicked-call',
      searchContext: '+15555550100',
      startTime,
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.action_id).to.equal('action-click');
        expect(values.patient_id).to.equal('patient-click');
      });
  });

  specify('records an 8x8 call that was never accepted', function() {
    Radio.reply('settings', 'get', () => '8x8');

    cy
      .intercept('PATCH', '/api/artifacts/**', {
        statusCode: 201,
        body: { data: {} },
      })
      .as('patchArtifact');

    cy.then(async() => {
      await service.start();
    });

    postEightByEightEvent('mashell-voice-phone-terminated-uc-event-v1', {
      eventName: 'terminated',
      eventId: 'missed-1',
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext: '+15555550100',
      startTime: '1793723417987',
      endTime: '1793723419000',
      callDuration: '00:00:01',
      hasRecording: false,
      schemaVersion: '1.0.0',
    });

    cy
      .wait('@patchArtifact')
      .its('request.body.data.attributes.values')
      .should(values => {
        expect(values.report.Last_Leg_Disposition).to.equal('Not-Connected');
        expect(values.report.Answered).to.equal(null);
        expect(values.callData.callDuration).to.equal('0:00:01');
        expect(values.callData.hasRecording).to.equal(false);
        expect(values.action_id).to.equal(null);
        expect(values.patient_id).to.equal(null);
        expect(values.events).to.equal(undefined);
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

  function postManualCall({ eventId, searchContext, startTime }) {
    postEightByEightEvent('mashell-voice-phone-offered-uc-event-v1', {
      eventName: 'offered',
      eventId: `${ eventId }-offered`,
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext,
      startTime,
      schemaVersion: '1.0.0',
    });

    postTerminatedCall({ eventId, searchContext, startTime });
  }

  function stubPatientPhones(phones) {
    const request = Radio.request;

    cy.stub(Radio, 'request').callsFake((channelName, requestName, ...args) => {
      if (channelName === 'entities' && requestName === 'patientFields:model') {
        return {
          value: null,
          get(key) {
            return this[key];
          },
          fetch() {
            this.value = phones;
            return Promise.resolve();
          },
        };
      }

      return request.call(Radio, channelName, requestName, ...args);
    });
  }

  function clickToCall(number, actionId, at) {
    cy.tick(at);

    cy.then(() => {
      Radio.request('dialer', 'call', number, { id: actionId });
    });
  }

  function postTerminatedCall({ eventId, searchContext, startTime }) {
    postEightByEightEvent('mashell-voice-phone-terminated-uc-event-v1', {
      eventName: 'terminated',
      eventId,
      method: 'mapEvent',
      direction: 'outbound',
      media: 'phone',
      searchContext,
      startTime,
      endTime: String(Number(startTime) + 10000),
      callDuration: '00:00:10',
      hasRecording: false,
      schemaVersion: '1.0.0',
    });
  }

  function postEightByEightEvent(eventType, data) {
    cy.window().then(win => {
      win.dispatchEvent(new win.MessageEvent('message', {
        origin: 'https://cloud8.8x8.com',
        data: {
          eventType,
          status: 'success',
          data,
        },
      }));
    });
  }

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
