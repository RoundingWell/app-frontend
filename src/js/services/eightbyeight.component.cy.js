import { Radio, View } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import { LayoutView } from '@roundingwell/care-ops-8x8/eightbyeight_views.js';
import { attachmentForCall, sameCall } from '@roundingwell/care-ops-8x8/eightbyeight_call_log.js';
import DialerService from './dialer';

const NOW = 1794240000000;
const NUMBER = '+16513216543';
const action = { id: 'action-1', getPatient: () => ({ id: 'patient-1' }) };

context('8x8 provider lifecycle and call identity', function() {
  let service;
  let provider;
  let save;
  let links;
  let scope;

  beforeEach(function() {
    scope = testScope();
    save = cy.stub().resolves();
    links = cy.stub();
    scope.reply(Radio, 'settings', 'get', () => '8x8');
    scope.reply(Radio, 'entities', 'save:artifacts:model', save);
    cy.stub(LayoutView.prototype, 'call').returns(true).as('dial');
    cy.intercept('https://cloud8.8x8.com/**', '<!doctype html><title>8x8 test frame</title>');

    cy
      .clock(NOW, ['Date'])
      .mount((root, mountScope) => {
        service = mountScope.own(new DialerService({ region: root.getRegion('overlay') }));
        mountScope.reply(Radio, 'dialer', 'showPatientLinks', links);
        return new View({ template: false });
      });

    cy.then(async() => {
      await service.start();
      provider = service.getChildApp('provider');
    });
  });

  specify('clears pending intent, frame readiness and subscriptions on stop and works after reentry', function() {
    ready();
    cy.then(() => service.call(NUMBER, action));
    post('accepted');
    cy.then(() => service.stop());
    post('terminated');
    cy.then(async() => {
      expect(save).not.to.have.been.called;
      await service.start();
      expect(provider.getState().get('isOpen')).to.equal(false);
    });
    post('terminated');
    cy.then(() => expect(save.firstCall.args[0].values.action_id).to.equal(null));
    cy.tick(1000);
    ready();
    cy.then(() => service.call(NUMBER, action));
    post('accepted', { startTime: String(NOW + 1000) });
    post('terminated', { eventId: 'terminated-2', startTime: String(NOW + 1000) });
    cy.then(() => expect(save.secondCall.args[0].values.action_id).to.equal(action.id));
  });

  specify('does not reuse an unaccepted click after stop and reentry', function() {
    ready();
    cy.then(() => service.call(NUMBER, action));
    cy.then(() => service.stop());
    cy.then(() => service.start());
    post('accepted');
    post('terminated');
    cy.then(() => expect(save.firstCall.args[0].values).to.include({ action_id: null, patient_id: null }));
  });

  specify('matches only complete call identity and an outbound click within its forward time window', function() {
    const pending = { number: NUMBER, actionId: 'action-1', patientId: 'patient-1', clickedAt: NOW };
    const event = { direction: 'outbound', searchContext: NUMBER, startTime: String(NOW) };
    expect(attachmentForCall(pending, event)).to.deep.equal({ actionId: 'action-1', patientId: 'patient-1' });
    expect(attachmentForCall(pending, { ...event, startTime: new Date(NOW).toISOString() }))
      .to.deep.equal({ actionId: 'action-1', patientId: 'patient-1' });
    expect(attachmentForCall(pending, { ...event, direction: 'inbound' })).to.equal(null);
    expect(attachmentForCall(pending, { ...event, searchContext: '+16513216544' })).to.equal(null);
    expect(attachmentForCall(pending, { ...event, startTime: String(NOW - 1) })).to.equal(null);
    expect(attachmentForCall(pending, { ...event, startTime: String(NOW + 120001) })).to.equal(null);
    expect(attachmentForCall(pending, { ...event, startTime: 'invalid' })).to.equal(null);
    expect(sameCall(event, { ...event, startTime: String(NOW + 1) })).to.equal(false);
    expect(sameCall(event, { ...event, searchContext: '(651) 321-6543' })).to.equal(true);
    expect(sameCall(event, { ...event, startTime: new Date(NOW).toISOString() })).to.equal(true);
    expect(sameCall({ ...event, startTime: null }, event)).to.equal(false);
  });

  function ready() {
    cy.get('.eightbyeight-panel__iframe').then($frame => {
      $frame[0].dispatchEvent(new Event('load'));
    });
  }

  function post(eventName, overrides = {}) {
    cy.window().then(win => {
      win.dispatchEvent(new win.MessageEvent('message', {
        origin: 'https://cloud8.8x8.com',
        data: {
          status: 'success',
          eventType: `mashell-voice-phone-${ eventName }-uc-event-v1`,
          data: {
            eventName,
            eventId: `${ eventName }-1`,
            direction: 'outbound',
            media: 'phone',
            searchContext: NUMBER,
            startTime: String(NOW),
            endTime: String(NOW + 10000),
            callDuration: '00:00:10',
            ...overrides,
          },
        },
      }));
    });
  }
});
