import { getRelationship } from 'helpers/json-api';
import { getAction } from 'support/api/actions';
import { getPatient } from 'support/api/patients';
import { getPatientField } from 'support/api/patient-fields';
import { stateTodo } from 'support/api/states';

const NOW = 1794240000000;
const NUMBER = '+16513216543';
const OTHER_NUMBER = '+16513216544';

context('8x8 click-to-call', function() {
  let patient;
  let otherPatient;
  let action;
  let calls;
  let saves;
  let frameReady;
  let frameBarrier;
  let releases;

  beforeEach(function() {
    patient = getPatient();
    otherPatient = getPatient({ attributes: { first_name: 'Other', last_name: 'Caller' } });
    action = getAction({
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(patient),
        flow: getRelationship(),
      },
    });
    calls = [];
    saves = [];
    frameReady = false;
    frameBarrier = false;
    releases = [];
  });

  afterEach(function() {
    releases.forEach(release => release());
  });

  specify('queues the real picker command, supports keyboard toggling and saves a long call after navigation without clipboard access', function() {
    let releaseFrame;
    const frameGate = new Cypress.Promise(resolve => {
      releaseFrame = resolve;
    });
    releases.push(releaseFrame);
    visit({ frameGate });
    dial();
    cy.get('.eightbyeight-wrapper').should('have.class', 'is-open');
    cy.then(() => {
      expect(calls).to.have.length(0);
      releaseFrame();
    });
    cy.wait('@embed');
    expectDials(1);
    cy.then(() => expect(calls[0]).to.deep.equal({
      eventName: 'maEvent',
      family: 'external',
      content: { eventName: 'startCall', method: 'mapDirective', phoneNumber: NUMBER },
      schemaVersion: '1.0.0',
    }));

    cy.get('.eightbyeight-panel__header').should('have.prop', 'tagName', 'BUTTON').focus().should('be.focused');
    cy.press(Cypress.Keyboard.Keys.SPACE);
    cy
      .get('.eightbyeight-panel__header')
      .should('have.attr', 'aria-expanded', 'false')
      .and('be.focused');
    cy.get('.eightbyeight-panel__header').focus().should('be.focused');
    // Cypress 16.2.1 press(Enter) omits the CDP text needed for native button activation.
    cy.press(Cypress.Keyboard.Keys.SPACE);
    cy.get('.eightbyeight-panel__header').should('have.attr', 'aria-expanded', 'true');

    post('offered', { direction: 'inbound' });
    cy.get('#eightbyeight-call-status').should('have.attr', 'role', 'status').and('have.text', 'Incoming call');
    cy.get('.eightbyeight-panel__header').should('have.attr', 'aria-describedby', 'eightbyeight-call-status');
    post('accepted', { startTime: new Date(NOW).toISOString() });
    cy.get('#eightbyeight-call-status').should('have.text', 'Call active');
    post('offered', { direction: 'inbound', searchContext: OTHER_NUMBER });
    cy.get('.eightbyeight-panel__header').should('have.class', 'is-call-active').and('contain', 'Call:');
    cy.get('.patient-action [data-dialer-region] button').should('contain', 'Call Number');
    cy.tick(180000);
    cy.get('#eightbyeight-call-status').should('have.text', 'Call active');

    cy
      .get('.patient__context-trail .js-patient')
      .click()
      .wait('@routePatientActions');

    post('terminated');
    cy
      .wait('@saveCall')
      .its('request.body.data.attributes')
      .should(attributes => {
        expect(attributes.artifact).to.equal('8x8-call-log');
        expect(attributes.identifier).to.equal('terminated-1');
        expect(attributes.values).to.include({ action_id: action.id, patient_id: patient.id });
        expect(attributes.values.callData).to.include({ searchContext: NUMBER, patientSearchNumber: NUMBER, callDuration: '0:00:10' });
        expect(attributes.values.report).to.include({ Answered: 'Answered', Last_Leg_Disposition: 'Connected' });
      });
    cy.get('.eightbyeight-panel__header').should('not.have.class', 'is-call-active');
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');
    cy.get('@writeClipboard').should('not.have.been.called');
    cy.get('@readClipboard').should('not.have.been.called');

    post('accepted', { eventId: 'manual-accepted', startTime: String(NOW + 180001) });
    post('terminated', { eventId: 'manual-terminated', startTime: String(NOW + 180001) });
    cy.wait('@saveCall').its('request.body.data.attributes.values').should('include', { action_id: null, patient_id: null });
  });

  specify('tracks only the current call without restoring a replaced call and isolates delayed saves', function() {
    let releaseSave;
    const saveGate = new Cypress.Promise(resolve => {
      releaseSave = resolve;
    });
    releases.push(releaseSave);
    visit({ saveGate });
    dial();
    expectDials(1);
    post('accepted');
    cy.tick(60000);
    cy.get('.eightbyeight-panel__header').should('contain', 'Call: 01:00');
    post('accepted', { eventId: 'accepted-2', searchContext: OTHER_NUMBER, startTime: String(NOW + 500) });
    cy.get('.eightbyeight-panel__header').should('contain', 'Call: 00:00');
    cy.tick(30000);
    cy.get('.eightbyeight-panel__header').should('contain', 'Call: 00:30');
    cy.wait('@searchPatients');
    cy.get('.eightbyeight-panel__patient-btn').should('have.length', 1).and('contain', 'Other Caller');

    post('terminated', { eventId: 'terminated-2', searchContext: OTHER_NUMBER, startTime: String(NOW + 500) });
    cy.wait('@saveCall').its('request.body.data.attributes.values').should('include', { action_id: null, patient_id: null });
    cy.get('.eightbyeight-panel__patient-btn').should('not.exist');
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');
    post('terminated');
    cy.get('.eightbyeight-panel__header').should('not.have.class', 'is-call-active');
    cy.tick(1000);
    dial();
    expectDials(2);
    post('accepted', { eventId: 'accepted-next', startTime: String(NOW + 91000) });
    post('terminated');
    cy.then(() => releaseSave());
    cy.wait('@saveCall').its('request.body.data.attributes.values').should(values => {
      expect(values).to.include({ action_id: null, patient_id: null });
      expect(values.report).to.include({ Answered: null, Last_Leg_Disposition: null });
    });
    cy.get('.eightbyeight-panel__header').should('have.class', 'is-call-active');

    post('terminated', { eventId: 'stale-termination', startTime: String(NOW - 1000) });
    cy.wait('@saveCall').its('request.body.data.attributes.values.action_id').should('be.null');
    cy.get('.eightbyeight-panel__header').should('not.have.class', 'is-call-active');
    post('terminated', { eventId: 'terminated-next', startTime: String(NOW + 91000) });
    cy.wait('@saveCall').its('request.body.data.attributes.values.action_id').should('be.null');
    cy.get('.eightbyeight-panel__header').should('not.have.class', 'is-call-active');
    cy.then(() => expect(saves).to.have.length(4));
  });

  specify('clears the panel on any call end without borrowing a replaced call association', function() {
    visit();
    dial();
    expectDials(1);
    post('accepted');
    post('accepted', { eventId: 'accepted-2', searchContext: OTHER_NUMBER, startTime: String(NOW + 500) });
    cy.wait('@searchPatients');
    post('accepted', { eventId: 'duplicate-accepted-2', searchContext: OTHER_NUMBER, startTime: String(NOW + 500) });
    post('terminated');
    cy.wait('@saveCall').its('request.body.data.attributes.values').should(values => {
      expect(values).to.include({ action_id: null, patient_id: null });
      expect(values.report).to.include({ Answered: null, Last_Leg_Disposition: null });
    });
    cy.get('.eightbyeight-panel__patient-btn').should('not.exist');
    cy.get('.eightbyeight-panel__header').should('not.have.class', 'is-call-active');
    post('terminated', { eventId: 'terminated-2', searchContext: OTHER_NUMBER, startTime: String(NOW + 500) });
    cy.wait('@saveCall').its('request.body.data.attributes.values.report.Answered').should('be.null');
    cy.get('.eightbyeight-panel__patient-btn').should('not.exist');
    cy.get('.eightbyeight-panel__header').should('not.have.class', 'is-call-active');
  });

  specify('clears inbound ringing and active presentation when termination timestamps differ', function() {
    visit();
    post('offered', { direction: 'inbound', searchContext: OTHER_NUMBER });
    cy.wait('@searchPatients');
    cy.get('.eightbyeight-panel__patient-btn').should('contain', 'Other Caller');
    cy.get('#eightbyeight-call-status').should('have.text', 'Incoming call');
    post('terminated', { direction: 'inbound', searchContext: OTHER_NUMBER, startTime: String(NOW + 1) });
    cy.wait('@saveCall');
    cy.get('.eightbyeight-panel__patient-btn').should('not.exist');
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');

    post('accepted', { direction: 'inbound', searchContext: OTHER_NUMBER });
    cy.wait('@searchPatients');
    cy.get('.eightbyeight-panel__patient-btn').should('contain', 'Other Caller');
    cy.get('#eightbyeight-call-status').should('have.text', 'Call active');
    post('terminated', {
      eventId: 'inbound-end',
      direction: 'inbound',
      searchContext: OTHER_NUMBER,
      startTime: String(NOW + 1),
    });
    cy.wait('@saveCall').its('request.body.data.attributes.values').should(values => {
      expect(values).to.include({ action_id: null, patient_id: null });
      expect(values.report).to.include({ Answered: null, Last_Leg_Disposition: null });
    });
    cy.get('.eightbyeight-panel__patient-btn').should('not.exist');
    cy.get('.eightbyeight-panel__header').should('not.have.class', 'is-call-active');
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');
  });

  specify('allows a new click immediately and preserves its intent through an unrelated inbound termination', function() {
    visit();
    dial();
    expectDials(1);
    cy.tick(1000);
    dial();
    expectDials(2);
    post('offered');
    post('terminated', { eventId: 'unrelated', direction: 'inbound' });
    cy.wait('@saveCall').its('request.body.data.attributes.values.action_id').should('be.null');
    post('terminated', { startTime: String(NOW + 1000) });
    cy.wait('@saveCall').its('request.body.data.attributes.values').should(values => {
      expect(values).to.include({ action_id: action.id, patient_id: patient.id });
      expect(values.report).to.include({ Answered: null, Last_Leg_Disposition: null });
    });
    expectDials(2);
  });

  specify('cancels an unsent request interrupted by another call and permits a fresh click', function() {
    let releaseFrame;
    const frameGate = new Cypress.Promise(resolve => {
      releaseFrame = resolve;
    });
    releases.push(releaseFrame);
    visit({ frameGate });
    dial();
    post('accepted', { direction: 'inbound' });
    cy.then(() => releaseFrame());
    cy.wait('@embed');
    expectFrameReady();
    post('terminated', { direction: 'inbound' });
    cy.wait('@saveCall').its('request.body.data.attributes.values.action_id').should('be.null');
    cy.then(() => expect(calls).to.have.length(0));
    dial();
    expectDials(1);
  });

  specify('invalidates unaccepted attribution on schema failure without redialing or clearing an accepted association', function() {
    visit();
    dial();
    expectDials(1);
    cy.get('.eightbyeight-panel__iframe').should('have.attr', 'allow', 'microphone *; speaker-selection *');
    post('accepted', {}, 'failed');
    expectFrameReady();
    expectDials(1);
    post('accepted');
    post('terminated');
    cy.wait('@saveCall').its('request.body.data.attributes.values')
      .should('include', { action_id: null, patient_id: null });

    cy.tick(1000);
    dial();
    expectDials(2);
    post('accepted', { eventId: 'accepted-next', startTime: String(NOW + 1000) });
    post('terminated', {}, 'failed');
    cy.get('#eightbyeight-call-status').should('have.text', 'Call active');
    post('terminated', { eventId: 'terminated-next', startTime: String(NOW + 1000) });
    cy.wait('@saveCall').its('request.body.data.attributes.values')
      .should('include', { action_id: action.id, patient_id: patient.id });
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');
  });

  specify('discards a queued request that expires before the frame loads', function() {
    let releaseFrame;
    const frameGate = new Cypress.Promise(resolve => {
      releaseFrame = resolve;
    });
    releases.push(releaseFrame);
    visit({ frameGate });
    dial();
    cy.tick(120001);
    cy.then(() => releaseFrame());
    cy.wait('@embed');
    expectFrameReady();
    cy.get('.eightbyeight-wrapper').should('have.class', 'is-open');
    cy.then(() => expect(calls).to.have.length(0));
    dial();
    expectDials(1);
  });

  specify('keeps patient matches scrollable and the panel reachable on a short viewport', function() {
    const matches = Array.from({ length: 12 }, (_, index) => getPatient({
      attributes: { first_name: 'Match', last_name: String(index) },
    }));
    cy.viewport(1000, 400);
    visit({ matches });
    post('offered', { direction: 'inbound', searchContext: OTHER_NUMBER });
    cy.wait('@searchPatients');
    cy.get('.eightbyeight-panel__patient-btn').should('have.length', matches.length);
    cy.get('.eightbyeight-patients').should($region => {
      expect($region[0].scrollHeight).to.be.greaterThan($region[0].clientHeight);
    });
    cy.get('.eightbyeight-panel__header').should($header => {
      const rect = $header[0].getBoundingClientRect();
      expect(rect.top).to.be.at.least(0);
      expect(rect.bottom).to.be.at.most(400);
      expect($header[0].contains($header[0].ownerDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))).to.equal(true);
    });
    cy.get('.eightbyeight-panel__header').click();
    cy.get('.eightbyeight-panel__header').should($header => {
      const rect = $header[0].getBoundingClientRect();
      expect(rect.top).to.be.at.least(0);
      expect(rect.bottom).to.be.at.most(400);
    });
    cy.get('.eightbyeight-patients').scrollTo('bottom');
    cy.get('.eightbyeight-panel__patient-btn').last().should($button => {
      const region = $button[0].closest('.eightbyeight-patients').getBoundingClientRect();
      const button = $button[0].getBoundingClientRect();
      expect(button.top).to.be.at.least(region.top);
      expect(button.bottom).to.be.at.most(region.bottom);
      expect($button[0].contains($button[0].ownerDocument.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2))).to.equal(true);
    });
    cy.get('.eightbyeight-panel').scrollTo('bottom');
    cy.get('.eightbyeight-panel__iframe').should($iframe => {
      const panel = $iframe[0].closest('.eightbyeight-panel').getBoundingClientRect();
      const frame = $iframe[0].getBoundingClientRect();
      expect(frame.bottom).to.be.at.most(panel.bottom + 1);
      expect(panel.bottom).to.be.at.most(400);
    });
    cy.get('.eightbyeight-panel__header').click();
    cy.get('.eightbyeight-wrapper').should('not.have.class', 'is-open');
  });

  specify('recognizes phone-specific inbound events without media and navigates Jump to without action attribution', function() {
    visit();
    post('offered', { direction: 'inbound', searchContext: OTHER_NUMBER, media: 'video' });
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');
    post('offered', { direction: 'inbound', searchContext: OTHER_NUMBER, media: undefined });
    cy.get('#eightbyeight-call-status').should('have.text', 'Incoming call');
    cy.get('.eightbyeight-panel__patient-btn').should('contain', 'Other Caller');
    post('accepted', { direction: 'inbound', searchContext: OTHER_NUMBER, media: undefined });
    cy.get('#eightbyeight-call-status').should('have.text', 'Call active');
    cy.routePatient(fx => {
      fx.data = otherPatient;
      return fx;
    }).routePatientActions(fx => {
      fx.data = [];
      return fx;
    });
    cy.get('.eightbyeight-panel__patient-btn').contains('Other Caller').click();
    cy.url().should('include', `/patient/${ otherPatient.id }`);
    cy.get('.eightbyeight-panel__patient-btn').should('not.exist');
    cy.get('#eightbyeight-call-status').should('have.text', 'Call active');
    post('terminated', { direction: 'inbound', searchContext: OTHER_NUMBER, media: undefined });
    cy.wait('@saveCall').its('request.body.data.attributes.values')
      .should('include', { action_id: null, patient_id: null });
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');
  });

  specify('does not infer an action from a direct embedded call while a matching action is open', function() {
    visit();
    cy.get('.patient-action [data-dialer-region] button').should('contain', 'Call Number');
    post('accepted');
    post('terminated');
    cy.wait('@saveCall').its('request.body.data.attributes.values')
      .should('include', { action_id: null, patient_id: null });
    expectDials(0);
    cy.get('@writeClipboard').should('not.have.been.called');
    cy.get('@readClipboard').should('not.have.been.called');
  });

  specify('keeps the click expiry boundary without inferring the open action and allows a fresh explicit selection', function() {
    visit();
    dial();
    expectDials(1);
    cy.tick(120001);
    post('accepted', { startTime: String(NOW + 120001) });
    post('terminated', { startTime: String(NOW + 120001) });
    cy.wait('@saveCall').its('request.body.data.attributes.values.action_id').should('be.null');
    dial();
    expectDials(2);
    post('accepted', { eventId: 'fresh', startTime: String(NOW + 120001) });
    post('terminated', { eventId: 'fresh-end', startTime: String(NOW + 120001) });
    cy.wait('@saveCall').its('request.body.data.attributes.values')
      .should('include', { action_id: action.id, patient_id: patient.id });
  });

  specify('supplies only valid normalized numbers for evaluation lookup without losing raw call context', function() {
    visit();
    post('terminated', { searchContext: '(651) 321-6544' });
    cy.wait('@saveCall').its('request.body.data.attributes.values')
      .should(values => {
        expect(values.callData).to.include({ searchContext: OTHER_NUMBER, patientSearchNumber: OTHER_NUMBER });
        expect(values).to.include({ action_id: null, patient_id: null });
      });

    ['1234', 'not a phone', '+10000000000', '', null].forEach((number, index) => {
      post('terminated', { eventId: `invalid-${ index }`, searchContext: number });
      cy.wait('@saveCall').its('request.body.data.attributes.values')
        .should(values => {
          expect(values.callData).to.include({ searchContext: number || null, patientSearchNumber: null });
          expect(values).to.include({ action_id: null, patient_id: null });
        });
    });
    cy.get('#eightbyeight-call-status').should('have.text', 'No active call');
  });

  function visit({ frameGate, saveGate, matches = [otherPatient] } = {}) {
    cy.clock(NOW, ['Date']);
    cy.intercept('https://cloud8.8x8.com/**', req => {
      const reply = () => req.reply({
        headers: { 'content-type': 'text/html' },
        body: `<!doctype html><title>8x8 test frame</title><script>
          addEventListener('load', () => parent.postMessage({ type: 'test-frame-ready' }, '*'));
          addEventListener('message', event => {
            if (event.data?.type === 'test-frame-barrier') {
              parent.postMessage({ type: 'test-frame-barrier' }, '*');
              return;
            }
            if (event.data?.content?.eventName !== 'startCall') return;
            parent.postMessage({ type: 'test-start-call', message: event.data }, '*');
          });
        </script>`,
      });
      return frameGate ? frameGate.then(reply) : reply();
    }).as('embed');
    cy.intercept('PATCH', '/api/artifacts/**', req => {
      const attrs = req.body.data.attributes;
      saves.push(attrs);
      const reply = () => req.reply({ statusCode: 204, body: {} });
      return saveGate && attrs.identifier === 'terminated-1' ? saveGate.then(reply) : reply();
    }).as('saveCall');
    cy.intercept('GET', '/api/patients?filter*', req => {
      const number = new URL(req.url).searchParams.get('filter[search]');
      req.reply({ data: number === OTHER_NUMBER ? matches : [], included: [] });
    }).as('searchPatients');

    cy
      .routesForPatientAction()
      .routeSettings('dialer', '8x8')
      .routeAction(fx => {
        fx.data = action;
        fx.included.push(patient);
        return fx;
      })
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [action];
        return fx;
      })
      .routePatientField(fx => {
        fx.data = getPatientField({
          attributes: {
            name: 'phones',
            value: [{ label: 'home', number: NUMBER, preferred: true }],
          },
          relationships: { patient: getRelationship(patient) },
        });
        return fx;
      }, 'phones')
      .visit(`/patient/${ patient.id }/action/${ action.id }`, {
        onBeforeLoad(win) {
          Object.defineProperty(win.navigator, 'clipboard', {
            configurable: true,
            value: { writeText: cy.stub().as('writeClipboard'), readText: cy.stub().as('readClipboard') },
          });
          win.addEventListener('message', event => {
            if (event.data?.type === 'test-start-call') calls.push(event.data.message);
            if (event.data?.type === 'test-frame-ready') frameReady = true;
            if (event.data?.type === 'test-frame-barrier') frameBarrier = true;
          });
        },
      })
      .wait('@routeAction');
  }

  function dial() {
    cy.get('.patient-action [data-dialer-region] button').should('contain', 'Call Number').click();
    cy.get('.picklist .js-picklist-item').contains('(651) 321-6543').click();
  }

  function expectDials(count) {
    cy.get('.eightbyeight-wrapper').should(() => expect(calls).to.have.length(count));
  }

  function expectFrameReady() {
    cy.get('.eightbyeight-wrapper').should(() => expect(frameReady).to.equal(true));
    cy.get('.eightbyeight-panel__iframe').then($frame => {
      $frame[0].contentWindow.postMessage({ type: 'test-frame-barrier' }, 'https://cloud8.8x8.com');
    });
    cy.get('.eightbyeight-wrapper').should(() => expect(frameBarrier).to.equal(true));
  }

  function post(eventName, overrides = {}, status = 'success') {
    cy.window().then(win => {
      win.dispatchEvent(new win.MessageEvent('message', {
        origin: 'https://cloud8.8x8.com',
        data: {
          status,
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
            hasRecording: false,
            ...overrides,
          },
        },
      }));
    });
  }
});
