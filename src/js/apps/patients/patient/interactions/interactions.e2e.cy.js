import { findIndex, map, range } from 'underscore';

import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getInteraction } from 'support/api/interactions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getActivity } from 'support/api/events';
import { getComment } from 'support/api/comments';
import { getCurrentClinician } from 'support/api/clinicians';

context('patient interactions', function() {
  let pendingResponses;
  let requestCompletions;
  let restoreFetch;

  beforeEach(function() {
    pendingResponses = [];
    requestCompletions = [];
    restoreFetch = undefined;

    cy
      .intercept({ method: 'GET', url: '/api/patients/*/interactions*', middleware: true }, req => {
        const query = new URL(req.url).searchParams;
        if (query.get('page[limit]') === '3') req.alias = 'previewInteractions';
        else if (query.has('filter[action]') || query.has('filter[flow]')) req.alias = 'activityInteractions';
        else if (query.has('page[at]')) req.alias = 'anchoredPatientInteractions';
      });
  });

  afterEach(function() {
    for (const response of pendingResponses) response.release();
    restoreFetch?.();
    return Cypress.Promise.all([...requestCompletions, ...pendingResponses.map(response => response.drain)]);
  });

  specify('renders appointment statuses, cancellation reasons, and valid durations', function() {
    const patient = getPatient();
    const durations = [20, 20, 20, 0, null, 20, -1, '20', undefined];
    const durationLabels = ['20 min', '20 min', '20 min', '0 min', '', '20 min', '', '', ''];
    const appointments = map(['scheduled', 'completed', 'scheduled', 'scheduled', 'scheduled', 'checked_in', 'rescheduled', 'unknown', 'cancelled'], (status, index) => {
      const timestamp = index === 4 ? '2026-10-06T16:40:00Z' : '2026-10-08T19:00:00Z';
      const interaction = getInteraction({
        attributes: {
          channel: 'appointment',
          metadata: {
            status,
            appointment_type: `Clinic - Initial Visit ${ index }`,
            duration_minutes: durations[index],
            provider: 'UHP-Bundu',
            department: 'UHP_MD-HDG',
            timezone: 'America/Chicago',
            ...([2, 4].includes(index) && {
              cancelled_at: '2026-10-06T15:00:00Z',
              cancel_reason: 'Patient request',
            }),
          },
          occurred_at: status === 'completed' ? timestamp : null,
          expected_at: status === 'completed' ? null : timestamp,
        },
      });

      return interaction;
    });

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = appointments;
        return fx;
      })
      .visitOnClock(`/patient/${ patient.id }/interactions`, { now: '2026-10-06T12:00:00Z' });

    const labels = ['scheduled', 'completed', 'cancelled', 'scheduled', 'cancelled', 'checked in', '', '', ''];
    for (const [index, label] of labels.entries()) {
      cy
        .contains('.patient-interactions__item', `Clinic - Initial Visit ${ index }`)
        .within(() => {
          cy
            .get('.patient-interactions__activity-description')
            .should('contain', 'Appointment')
            .and('contain', index === 4 ? '11:40 AM' : '2:00 PM');

          cy
            .get('.patient-interactions__card')
            .should('contain', index === 4 ? 'Oct 6 at 11:40 AM' : 'Oct 8 at 2:00 PM')
            .and('contain', 'With UHP-Bundu at UHP_MD-HDG');

          cy
            .get('.patient-interactions__card')
            .should(durationLabels[index] ? 'contain' : 'not.contain', durationLabels[index] || ' min');

          cy
            .get('.patient-interactions__item-heading')
            .should('contain', `Clinic - Initial Visit ${ index }`)
            .and($heading => {
              if (label) expect($heading).to.contain(label);
              else expect($heading.text()).not.to.match(/scheduled|completed|cancelled|checked in/);
            });
          if (label === 'cancelled') {
            cy
              .get('.patient-interactions__cancellation')
              .should('contain', 'Cancelled: Patient request');
          }
          cy
            .get('.patient-interactions__action')
            .should('not.exist');
        });
    }
  });

  specify('navigates linked interactions, grouped paging, and date destinations', function() {
    const patient = getPatient();
    const flow = getFlow({
      attributes: { name: 'Team Referral Flow' },
      relationships: { patient: getRelationship(patient) },
    });
    const action = getAction({
      attributes: { name: 'SMS Outreach' },
      relationships: { patient: getRelationship(patient), flow: getRelationship(flow) },
    });
    const dischargeFlow = getFlow({
      attributes: { name: 'TCM - ER Discharge' },
      relationships: { patient: getRelationship(patient) },
    });
    const actionInteraction = getInteraction({
      attributes: {
        metadata: {
          message: 'Please call us to schedule your follow-up.',
          clinician_name: 'Alex Morgan',
        },
        occurred_at: '2026-09-24T11:00:00Z',
      },
      relationships: {
        action: getRelationship(action),
      },
    });

    const flowInteraction = getInteraction({
      attributes: {
        channel: 'visit',
        metadata: {
          visit_event: 'discharge',
          patient_class: 'E',
          source: 'Collective',
          facility: 'Example Medical Center',
          admitted_at: '2026-09-23T10:00:00+00:00',
          discharged_at: '2026-09-24T10:00:00+00:00',
          admit_reason: 'Shortness of breath',
          discharge_disposition: 'Discharged to home',
          discharge_location: 'Home',
        },
      },
      relationships: {
        flow: getRelationship(dischargeFlow),
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routeAction(fx => {
        fx.data = action;
        fx.included.push(flow);

        return fx;
      })
      .routeFlow(fx => {
        fx.data = flow;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [action];

        return fx;
      })
      .routeFlowActivity()
      .routePatientInteractions(fx => {
        fx.data = [actionInteraction, flowInteraction];
        fx.included = [action, flow, dischargeFlow];
        return fx;
      })
      .visitOnClock(`/patient/${ patient.id }/interactions`, { now: '2026-10-06T12:00:00Z', functionNames: ['Date'] });

    cy
      .get('.patient-interactions__item')
      .first()
      .within(() => {
        cy
          .contains('Discharged')
          .should('be.visible');

        cy
          .contains('Emergency')
          .should('be.visible');

        cy
          .contains('via Collective');

        cy
          .contains('LOS 1 day');

        cy
          .contains('Example Medical Center')
          .should('be.visible');

        cy
          .contains('Shortness of breath')
          .should('be.visible');

        cy
          .contains('Discharged to home')
          .should('be.visible');
      });

    cy
      .contains('.patient-interactions__item', 'Please call us to schedule your follow-up.')
      .should('contain', 'Alex Morgan');

    cy
      .get('.patient-interactions__action')
      .contains('Team Referral Flow: SMS Outreach')
      .click();

    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/flow/${ flow.id }/action/${ action.id }`);

    cy
      .get('.patient-action__header')
      .should('contain', 'SMS Outreach');

    cy
      .routeFlow(fx => {
        fx.data = dischargeFlow;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/patient/${ patient.id }/interactions`);

    cy
      .get('.patient-interactions__action')
      .contains('TCM - ER Discharge')
      .click();

    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/flow/${ dischargeFlow.id }`);

    cy
      .get('.patient-flow__header-container')
      .should('contain', 'TCM - ER Discharge');

    const otherAction = getAction({ attributes: { name: 'SMS Outreach' }, relationships: { patient: getRelationship(patient), flow: getRelationship(flow) } });
    const groupedActions = { 6: action, 7: otherAction, 8: otherAction };
    const grouped = map(['sms', 'sms', 'voice', 'sms', 'sms', 'sms', 'sms', 'sms', 'sms', 'sms', 'sms'], (channel, index) => {
      const interaction = getInteraction({
        attributes: {
          channel,
          direction: index === 1 ? 'inbound' : 'outbound',
          metadata: {
            clinician_name: 'Alex Morgan',
            [index === 1 ? 'body' : channel === 'voice' ? 'note' : 'message']: `Grouped message ${ index }`,
          },
          occurred_at: new Date(Date.UTC(2026, 8, index >= 5 ? 25 : 24, 10, index)).toISOString(),
        },
        relationships: {
          action: getRelationship(groupedActions[index]),
          flow: getRelationship(groupedActions[index] || index >= 9 ? undefined : index === 3 ? dischargeFlow : flow),
        },
      });

      return interaction;
    });

    const initial = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(initial);
    let initialStarted = false;
    const initialResponse = new Cypress.Promise(resolve => {
      initial.release = resolve;
    });

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const channels = new URL(req.url).searchParams.get('filter[channel]');
        const body = { data: [...grouped].reverse(), included: [flow, dischargeFlow, action, otherAction] };
        if (!channels && !initialStarted) {
          initialStarted = true;
          initial.drain = initialResponse.then(() => {
            req.reply({ body });
          });
          return initial.drain;
        }
        if (channels) body.data = body.data.filter(item => channels.split(',').includes(item.attributes.channel));
        req.reply({ body });
      })
      .as('initialInteractions')
      .visit(`/patient/${ patient.id }/interactions`, {
        onBeforeLoad(win) {
          const originalFetch = win.fetch.bind(win);
          restoreFetch = () => {
            win.fetch = originalFetch;
          };
          win.fetch = (...args) => {
            const request = originalFetch(...args);
            if (String(args[0]).includes('/interactions')) {
              requestCompletions.push(request.then(() => undefined, () => undefined));
            }
            return request;
          };
        },
      });

    cy
      .get('.patient-interactions-loading[role="status"]')
      .should('be.visible')
      .should(() => {
        expect(initialStarted).to.equal(true);
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .contains('.patient-interactions__item', 'Grouped message 10')
      .should('be.visible')
      .then(() => {
        initial.release();
      });

    cy
      .then(() => Cypress.Promise.all([initial.drain, ...requestCompletions]));

    cy
      .contains('.patient-interactions__item', 'Grouped message 2')
      .should('not.exist');

    cy
      .contains('.patient-interactions__item', 'Grouped message 10')
      .should('be.visible');

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .should('have.attr', 'aria-pressed', 'false')
      .click();

    cy
      .contains('.patient-interactions__item', 'Grouped message 10')
      .should('be.visible');

    cy
      .contains('.patient-interactions__item', 'Grouped message 0')
      .should('have.class', 'patient-interactions__item--continues');

    cy
      .contains('.patient-interactions__item', 'Grouped message 1')
      .should('have.class', 'patient-interactions__item--continuation')
      .find('.patient-interactions__activity-line')
      .scrollIntoView()
      .should('be.visible')
      .find('.js-action')
      .should('not.be.visible');

    cy
      .get('.patient-interactions__item--continuation')
      .should('have.length', 2);

    cy
      .get('.patient-interactions__item--continues')
      .should('have.length', 2);
    for (const index of [6, 7, 9, 10]) {
      cy
        .contains('.patient-interactions__item', `Grouped message ${ index }`)
        .should('not.have.class', 'patient-interactions__item--continuation');
    }
    for (const index of [0, 1]) {
      cy
        .contains('.patient-interactions__item', `Grouped message ${ index }`)
        .should('contain', index ? 'Inbound' : 'Alex Morgan')
        .find('time')
        .should('have.attr', 'datetime', grouped[index].attributes.occurred_at);
    }
    cy
      .contains('.patient-interactions__item', 'Grouped message 0')
      .find('.js-action')
      .should('have.length', 1);
    const history = map(range(80), index => {
      const interaction = getInteraction({
        attributes: {
          metadata: {
            message: `Follow-up message ${ index }`,
          },
          occurred_at: new Date(Date.UTC(2026, 4, Math.max(4, 1 + index), index < 4 ? index : 0)).toISOString(),
        },
      });
      // The oldest page boundary cuts through a day containing four entries.

      return interaction;
    });
    cy
      .routePatientInteractions(fx => {
        fx.data = history;
        return fx;
      })
      .visit(`/patient/${ patient.id }/interactions/${ history[40].id }`);

    cy
      .wait('@anchoredPatientInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[at]')).to.equal(history[40].id);
      });

    cy
      .get('.patient-interactions__item')
      .should('have.length', 25)
      .first()
      .should('contain', 'Follow-up message 28');

    cy
      .get('.patient-interactions__item')
      .last()
      .should('contain', 'Follow-up message 52');

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Follow-up message 40')
      .and('be.focused');

    let failOlder = true;

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        const before = query.get('page[before]');
        const after = query.get('page[after]');
        if (before) {
          req.alias = 'olderInteractions';
          if (failOlder) {
            failOlder = false;
            req.reply({ statusCode: 422, body: { errors: [{ title: 'Unavailable' }] } });
            return;
          }
          const index = findIndex(history, item => item.id === before);
          req.reply({ body: { data: history.slice(Math.max(0, index - 25), index).reverse() } });
          return;
        }
        if (after) {
          req.alias = 'newerInteractions';
          const index = findIndex(history, item => item.id === after);
          req.reply({ body: { data: history.slice(index + 1, index + 26) } });
          return;
        }
        req.alias = 'anchoredInteractions';
        req.reply({ body: { data: history.slice(28, 53) } });
      });

    cy
      .visit(`/patient/${ patient.id }/interactions/${ history[40].id }`);

    cy
      .wait('@anchoredInteractions');

    cy
      .get('.patient-interactions__item')
      .should('have.length', 25);

    cy
      .get('.patient-interactions')
      .scrollTo('top');

    cy
      .wait('@olderInteractions');

    cy
      .contains('More interactions could not be loaded.')
      .should('be.visible');

    cy
      .get('.patient-interactions__item')
      .should('have.length', 25);

    cy
      .contains('.patient-interactions__item', 'Follow-up message 28')
      .then($anchor => {
        const top = $anchor[0].getBoundingClientRect().top;

        cy
          .contains('button', 'Retry')
          .click();

        cy
          .wait('@olderInteractions')
          .its('request.url')
          .then(url => {
            expect(new URL(url).searchParams.get('page[before]')).to.equal(history[28].id);
          });

        cy
          .get('.patient-interactions__item')
          .should('have.length', 50);

        cy
          .contains('.patient-interactions__item', 'Follow-up message 28')
          .then($current => {
            expect(Math.abs($current[0].getBoundingClientRect().top - top)).to.be.lessThan(2);
          });
      });

    cy
      .get('.patient-interactions')
      .scrollTo('bottom');

    cy
      .wait('@newerInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[after]')).to.equal(history[52].id);
      });

    cy
      .get('.patient-interactions__item')
      .should('have.length', 75);

    cy
      .get('.patient-interactions')
      .scrollTo('bottom');

    cy
      .wait('@newerInteractions');

    cy
      .get('.patient-interactions__item')
      .should('have.length', 77);

    cy
      .get('.patient-interactions')
      .scrollTo('top');

    cy
      .wait('@olderInteractions');

    cy
      .get('.patient-interactions__item')
      .should('have.length', 80);

    cy
      .contains('Follow-up message 0')
      .should('exist');

    cy
      .contains('Follow-up message 79')
      .should('exist');

    cy
      .visit(`/patient/${ patient.id }/interactions/${ history[40].id }`);

    cy
      .wait('@anchoredInteractions');

    cy
      .get('.patient-interactions')
      .scrollTo('top');

    cy
      .wait('@olderInteractions');

    cy
      .get('.patient-interactions__item')
      .should('have.length', 50);

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click({ scrollBehavior: false });

    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();

    cy
      .get('.patient-interactions__calendar-modal .datepicker__days a')
      .contains(/^4$/)
      .click();

    cy
      .wait('@olderInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[before]')).to.equal(history[3].id);
      });

    cy
      .get('.patient-interactions__item')
      .should('have.length', 53);

    cy
      .contains('.patient-interactions__date-divider .patient-interactions__date-button', 'May 4')
      .should('be.visible')
      .then($date => {
        cy
          .get('.patient-pages-controls')
          .then($controls => {
            expect($date[0].getBoundingClientRect().top).to.be.at.least($controls[0].getBoundingClientRect().bottom);
          });
      });

    cy
      .contains('.patient-interactions__item', 'Follow-up message 0')
      .should('be.visible');

    cy
      .get('.patient-interactions__toolbar-date')
      .should('contain', 'May 4');

    cy
      .get('.patient-interactions .js-today')
      .should('be.visible')
      .click({ scrollBehavior: false });

    cy
      .get('.patient-interactions__item')
      .should('have.length', 80);

    cy
      .contains('.patient-interactions__item', 'Follow-up message 79')
      .should('be.visible');

    cy
      .focused()
      .should('have.class', 'patient-interactions__date-button')
      .and('contain', 'Jul 19');

    cy
      .get('.patient-interactions__toolbar-date')
      .should('be.visible');

    cy
      .get('.patient-pages-controls')
      .should('be.visible');

    cy
      .get('.js-filter')
      .should('be.visible');

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click({ scrollBehavior: false });

    cy
      .contains('.js-picklist-item', 'The very beginning')
      .click();

    cy
      .contains('.patient-interactions__item', 'Follow-up message 0')
      .should('be.visible');

    cy
      .routePatientInteractions(fx => {
        fx.data = history;
        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.has('page[after]')) req.alias = 'forwardDatePage';
      })
      .visit(`/patient/${ patient.id }/interactions/${ history[10].id }`);

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Follow-up message 10')
      .and('be.focused');

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click({ scrollBehavior: false });

    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();

    cy
      .get('.patient-interactions__calendar-modal .datepicker__days a')
      .contains(/^30$/)
      .click();

    cy
      .wait('@forwardDatePage')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[after]')).to.equal(history[22].id);
      });

    cy
      .get('.patient-interactions__item')
      .should('have.length', 48);

    cy
      .contains('.patient-interactions__date-divider .patient-interactions__date-button', 'May 30')
      .should('be.visible');
  });

  specify('keeps a loaded sidebar target focused when it supersedes a date request', function() {
    const patient = getPatient();
    const history = map(range(80), index => {
      const interaction = getInteraction({
        attributes: {
          metadata: {
            message: `Navigation message ${ index }`,
          },
          occurred_at: new Date(Date.UTC(2026, 4, index + 1)).toISOString(),
        },
      });

      return interaction;
    });
    const older = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(older);
    let olderStarted = false;
    const olderResponse = new Cypress.Promise(resolve => {
      older.release = resolve;
    });

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routeSettings('sidebar', ['interactions'])
      .routePanels(fx => {
        fx.data = [{ id: 'interactions', type: 'panels', attributes: { slug: 'interactions', name: 'Interactions', widgets: ['interactions'] } }];

        return fx;
      })
      .routeWidgets(fx => {
        fx.data = [{ id: 'interactions', type: 'widgets', attributes: { category: 'interactions', slug: 'interactions', definition: {} } }];

        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = history;
        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (!new URL(req.url).searchParams.has('page[before]')) return;
        olderStarted = true;
        older.drain = olderResponse.then(() => {
          req.reply({ body: { data: history.slice(30, 55).reverse() } });
        });
        return older.drain;
      })
      .visit(`/patient/${ patient.id }/interactions/${ history[67].id }`, {
        onBeforeLoad(win) {
          const originalFetch = win.fetch.bind(win);
          restoreFetch = () => {
            win.fetch = originalFetch;
          };
          win.fetch = (...args) => {
            const request = originalFetch(...args);
            if (String(args[0]).includes('/interactions')) {
              requestCompletions.push(request.then(() => undefined, () => undefined));
            }
            return request;
          };
        },
      });

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Navigation message 67')
      .and('be.focused');

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click({ scrollBehavior: false });

    cy
      .contains('.js-picklist-item', 'The very beginning')
      .click();

    cy
      .get('.patient-interactions .js-paging-loading')
      .should('not.have.attr', 'hidden')
      .should(() => {
        expect(olderStarted).to.equal(true);
      });

    cy
      .get('.patient-interactions-preview__link')
      .first()
      .click({ scrollBehavior: false });

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Navigation message 79')
      .and('be.focused')
      .then(() => {
        older.release();
      });

    cy
      .then(() => Cypress.Promise.all([older.drain, ...requestCompletions]));

    cy
      .get('.patient-interactions .js-paging-loading')
      .should('have.attr', 'hidden');

    cy
      .get('.patient-interactions__item')
      .should('have.length', 25);

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Navigation message 79')
      .and('be.focused')
      .and('be.visible');
  });

  specify('opens from workflow and a configured sidebar, then links through an action', function() {
    const patient = getPatient();
    const action = getAction({
      attributes: { name: 'Call patient' },
      relationships: { patient: getRelationship(patient) },
    });
    const interaction = getInteraction({
      attributes: {
        channel: 'voice',
        metadata: {
          clinician_name: 'Alex Morgan',
          disposition: 'Left Voicemail',
          made_contact: false,
          note: 'Left a message asking the patient to call back.',
        },
      },
      relationships: {
        action: getRelationship(action),
      },
    });
    const sameDay = getInteraction({
      attributes: {
        channel: 'sms',
        direction: 'inbound',
        metadata: {
          body: 'I can come in tomorrow morning.',
          from: '+16155550101',
        },
        occurred_at: '2026-09-24T09:59:00Z',
      },
    });

    const previousDay = getInteraction({
      attributes: {
        channel: 'appointment',
        metadata: {
          status: 'scheduled',
          appointment_type: 'Follow-up appointment.',
          provider: 'Taylor Lee',
        },
        occurred_at: '2026-09-23T10:00:00+00:00',
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routePatientByAction(fx => {
        fx.data = patient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [action];

        return fx;
      })
      .routeAction(fx => {
        fx.data = action;

        return fx;
      })
      .routeActionActivity(fx => {
        fx.data = [getActivity({ date: '2026-09-24T10:01:00Z', event_type: 'ActionDetailsUpdated', source: 'system' })];

        return fx;
      })
      .routeActionComments(fx => {
        fx.data = [getComment({
          attributes: { created_at: '2026-09-24T10:00:30Z', message: 'Patient follow-up comment', edited_at: null },
          relationships: { clinician: getRelationship(getCurrentClinician()) },
        })];

        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = [interaction, sameDay, previousDay];
        fx.included = [action];
        return fx;
      })
      .routeSettings('sidebar', ['interactions'])
      .routePanels(fx => {
        fx.data = [{
          id: 'interactions',
          type: 'panels',
          attributes: { slug: 'interactions', name: 'Interactions', widgets: ['interactions'] },
        }];

        return fx;
      })
      .routeWidgets(fx => {
        fx.data = [{
          id: 'interactions',
          type: 'widgets',
          attributes: { category: 'interactions', slug: 'interactions', definition: {} },
        }];

        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', {
        statusCode: 422,
        body: { errors: [{ title: 'Unavailable' }] },
      })
      .as('failedPreview')
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .wait('@failedPreview');

    cy
      .get('.patient-interactions-preview [role="alert"]')
      .should('contain', 'Interactions could not be loaded.');

    cy
      .routePatientInteractions(fx => {
        fx.data = [];
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.patient-interactions-preview')
      .should('contain', 'No interactions yet.');

    const visits = map([
      { admitted_at: '2026-09-24T08:00:00Z', facility: 'Clinic <b>East</b> & West' },
      { discharged_at: '2026-09-24T09:00:00Z', facility: 'Example Medical Center' },
      { admitted_at: '2026-09-24T10:00:00Z' },
    ], metadata => getInteraction({ attributes: { channel: 'visit', metadata } }));

    cy
      .routePatientInteractions(fx => {
        fx.data = visits;
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.patient-interactions-preview')
      .should('contain', 'Admitted • Clinic <b>East</b> & West')
      .and('contain', 'Discharged • Example Medical Center')
      .find('.patient-interactions-preview__title')
      .should('have.length', 3)
      .and($titles => {
        expect($titles.toArray().map(title => title.textContent)).to.include('Admitted');
      });

    cy
      .get('.patient-interactions-preview__title b')
      .should('not.exist');

    const sparsePreview = [
      getInteraction({ attributes: { channel: 'voice', direction: 'inbound', metadata: { note: 'Inbound callback' } } }),
      getInteraction({ attributes: { metadata: null } }),
      getInteraction({ attributes: { channel: 'appointment', metadata: { appointment_type: 'Consultation' } } }),
    ];

    cy
      .routePatientInteractions(fx => {
        fx.data = sparsePreview;
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.patient-interactions-preview')
      .should('contain', 'Inbound Call')
      .and('contain', 'Outbound Message')
      .find('.patient-interactions-preview__title')
      .should('have.length', 3)
      .and($titles => {
        expect($titles.toArray().map(title => title.textContent)).to.include('Appointment');
      });

    cy
      .routePatientInteractions(fx => {
        fx.data = [interaction, sameDay, previousDay];
        fx.included = [action];
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .wait('@previewInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[limit]')).to.equal('3');
      });

    cy
      .get('.patient-interactions-preview__link')
      .first()
      .should('contain', 'Outbound Call')
      .and('contain', 'Left Voicemail')
      .and('contain', 'Alex Morgan')
      .click();

    cy
      .wait('@anchoredPatientInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[at]')).to.equal(interaction.id);
      });

    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/interactions/${ interaction.id }`);

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Outbound Call')
      .and('contain', 'Left Voicemail')
      .and('contain', 'Left a message asking the patient to call back.');
    let timelineElement;
    let navigationRequests = 0;

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.has('page[at]')) navigationRequests += 1;
      });

    cy
      .get('.patient-interactions')
      .then($el => {
        timelineElement = $el[0];
      });

    cy
      .get('.patient-interactions-preview__link')
      .eq(1)
      .click();

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'I can come in tomorrow morning.');

    cy
      .get('.patient-interactions')
      .should($el => {
        expect($el[0]).to.equal(timelineElement);
        expect(navigationRequests).to.equal(0);
      });

    cy
      .get('.patient-interactions-preview__link')
      .first()
      .click();

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Left a message asking the patient to call back.');

    cy
      .get('.patient-interactions-preview__all')
      .click();

    cy
      .location('pathname')
      .should('match', new RegExp(`/patient/${ patient.id }/interactions$`));

    cy
      .get('.patient-interactions__item.is-selected')
      .should('not.exist');

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .get('.patient-interactions__item--voice')
      .should('not.exist');

    cy
      .get('.patient-interactions-preview__link')
      .first()
      .click();

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .should('have.attr', 'aria-pressed', 'true');

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Left a message asking the patient to call back.')
      .and('be.focused');

    cy
      .window()
      .then(win => {
        const originalFetch = win.fetch.bind(win);
        restoreFetch = () => {
          win.fetch = originalFetch;
        };
        win.fetch = (...args) => {
          const request = originalFetch(...args);
          if (String(args[0]).includes('/interactions')) {
            requestCompletions.push(request.then(() => undefined, () => undefined));
          }
          return request;
        };
      });

    const targetFilter = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(targetFilter);
    let targetFilterStarted = false;
    const targetFilterResponse = new Cypress.Promise(resolve => {
      targetFilter.release = resolve;
    });

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (query.get('page[limit]') === '3' || query.has('page[at]') || query.has('page[before]') || query.has('page[after]') || targetFilterStarted) return;
        targetFilterStarted = true;
        targetFilter.drain = targetFilterResponse.then(() => {
          req.reply({ body: { data: [interaction, previousDay], included: [action] } });
        });
        return targetFilter.drain;
      });

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();

    cy
      .get('.patient-interactions-loading')
      .should('be.visible')
      .should(() => {
        expect(targetFilterStarted).to.equal(true);
      });

    cy
      .get('.patient-interactions-preview__link')
      .first()
      .click();

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Left a message asking the patient to call back.')
      .and('be.focused');

    cy
      .get('.patient-interactions .js-paging-loading')
      .should('have.attr', 'hidden')
      .then(() => {
        targetFilter.release();
      });

    cy
      .then(() => Cypress.Promise.all([targetFilter.drain, ...requestCompletions]));

    cy
      .contains('.patient-interactions__item', 'I can come in tomorrow morning.')
      .should('not.exist');

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Left a message asking the patient to call back.')
      .and('be.focused');

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();

    cy
      .contains('.patient-interactions__item', 'I can come in tomorrow morning.')
      .should('contain', '+16155550101');

    cy
      .contains('.patient-interactions__item', 'Follow-up appointment.')
      .should('contain', 'Taylor Lee');

    cy
      .get('.patient-interactions__date-divider')
      .should('have.length', 2);

    cy
      .get('.patient-interactions__controls')
      .should('be.visible');

    cy
      .get('.patient-interactions__date-button')
      .first()
      .click();

    cy
      .get('.picklist')
      .should('be.visible')
      .within(() => {
        cy
          .contains('Today')
          .should('be.visible');

        cy
          .contains('Yesterday')
          .should('be.visible');

        cy
          .contains('Last week')
          .should('be.visible');

        cy
          .contains('Last month')
          .should('be.visible');

        cy
          .contains('The very beginning')
          .should('be.visible');

        cy
          .contains('.js-picklist-item', 'Jump to a specific date')
          .click();
      });

    cy
      .get('.patient-interactions__calendar-modal')
      .should('be.visible')
      .and('be.focused');

    cy
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'patient-interactions__calendar-close')
      .and('have.css', 'outline-width', '2px')
      .click();

    cy
      .get('.patient-interactions__calendar-modal')
      .should('not.exist');

    cy
      .focused()
      .should('have.class', 'patient-interactions__date-button')
      .click();

    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();

    cy
      .press(Cypress.Keyboard.Keys.ESC);

    cy
      .get('.patient-interactions__calendar-modal')
      .should('not.exist');

    cy
      .focused()
      .should('have.class', 'patient-interactions__date-button');

    cy
      .get('.patient-interactions__toolbar-date .patient-interactions__date-button')
      .click();

    cy
      .get('.patient-interactions__toolbar-date .patient-interactions__date-button')
      .should('have.attr', 'aria-expanded', 'true')
      .click();

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('.patient-interactions__toolbar-date .patient-interactions__date-button')
      .should('have.attr', 'aria-expanded', 'false')
      .click();

    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();

    cy
      .get('.patient-interactions__calendar-modal .datepicker__days a')
      .contains(/^23$/)
      .click();

    cy
      .get('.patient-interactions__calendar-modal')
      .should('not.exist');

    cy
      .get('.patient-interactions__date-button')
      .eq(1)
      .click();

    cy
      .get('.picklist')
      .should('be.visible')
      .and('contain', 'The very beginning');

    cy
      .get('.patient-interactions__action')
      .should('contain', 'Call patient')
      .click();

    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/action/${ action.id }`);

    cy
      .wait('@activityInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[action]')).to.equal(action.id);
      });

    cy
      .get('.patient-action__activity .patient-interactions__card')
      .should('contain', 'Left a message asking the patient to call back.');

    cy
      .get('.patient-action__activity-items')
      .children()
      .should('have.length', 3)
      .then($items => {
        expect($items.eq(0)).to.contain('Left a message asking the patient to call back.');
        expect($items.eq(1)).to.contain('Patient follow-up comment');
        expect($items.eq(2)).to.have.class('patient-action__activity-item');
      });

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (!new URL(req.url).searchParams.has('filter[action]')) return;
        req.alias = 'failedActionInteractions';
        req.reply({ statusCode: 422, body: { errors: [{ title: 'Unavailable' }] } });
      })
      .visit(`/patient/${ patient.id }/action/${ action.id }`);

    cy
      .wait('@failedActionInteractions');

    cy
      .get('.patient-action__activity-items')
      .should('contain', 'Patient follow-up comment')
      .children()
      .should('have.length', 2);

    cy
      .get('.patient-action__comment-form .js-input')
      .should('be.visible');

    cy
      .get('.alert-box')
      .should('contain', 'Interactions could not be loaded.')
      .find('.js-dismiss')
      .click();

    const undatedAppointment = getInteraction({
      attributes: {
        channel: 'appointment',
        metadata: {
          appointment_type: 'Appointment details pending',
        },
        occurred_at: null,
      },
      relationships: {
        action: getRelationship(action),
      },
    });

    const inboundCall = getInteraction({
      attributes: {
        channel: 'voice',
        direction: 'inbound',
        metadata: {
          note: 'Inbound callback',
        },
      },
      relationships: {
        action: getRelationship(action),
      },
    });
    const missingMetadata = getInteraction({
      attributes: {
        metadata: null,
      },
      relationships: {
        action: getRelationship(action),
      },
    });

    cy
      .routePatientInteractions(fx => {
        fx.data = [interaction, sameDay, previousDay, undatedAppointment, inboundCall, missingMetadata];
        fx.included = [action];
        return fx;
      })
      .visit(`/patient/${ patient.id }/action/${ action.id }`);

    cy
      .get('.patient-action__activity .patient-interactions__card')
      .should('contain', 'Left a message asking the patient to call back.');

    cy
      .contains('.patient-action__activity .patient-interactions__item', 'Appointment details pending')
      .should('contain', 'Appointment')
      .and('not.contain', 'Invalid Date');

    cy
      .contains('.patient-action__activity .patient-interactions__item', 'Inbound callback')
      .find('.patient-interactions__marker use')
      .should('have.attr', 'href', '#far-fa-phone-arrow-down-left');

    cy
      .get('.patient-action__activity .patient-interactions__item--sms')
      .find('.patient-interactions__activity-description strong')
      .should('not.exist');

    cy
      .routePatientInteractions(fx => {
        fx.data = [interaction, sameDay, previousDay];
        fx.included = [action];
        return fx;
      });

    cy
      .contains('.patient-action__activity .patient-interactions__item', 'Left a message asking the patient to call back.')
      .contains('.js-interaction', 'View on Interactions')
      .click();

    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/interactions/${ interaction.id }`);

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Left a message asking the patient to call back.')
      .and('be.focused');

    cy
      .get('.patient-pages .js-workflow')
      .click();

    cy
      .get('.patient-pages .js-interactions')
      .click();

    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/interactions`);

    cy
      .get('.patient-interactions__item')
      .should('exist');

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const channels = new URL(req.url).searchParams.get('filter[channel]');
        if (!channels) {
          req.reply({ body: { data: [interaction, sameDay, previousDay], included: [action] } });
          return;
        }
        req.alias = channels.includes('voice') ? 'callInteractions' : 'filteredInteractions';
        req.reply({ body: { data: channels.includes('voice') ? [interaction] : [], included: [action] } });
      });

    cy
      .viewport(700, 900);

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .should('be.visible')
      .and('have.attr', 'aria-pressed', 'true')

      .focus();

    cy
      .press(Cypress.Keyboard.Keys.SPACE);

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .should('have.attr', 'aria-pressed', 'false');

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .should('have.attr', 'aria-pressed', 'true');

    cy
      .wait('@filteredInteractions')
      .its('request.url')
      .then(url => {
        const query = new URL(url).searchParams;
        expect(query.get('filter[channel]')).not.to.include('voice');
        expect(query.has('page[at]')).to.equal(false);
        expect(query.has('page[before]')).to.equal(false);
        expect(query.has('page[after]')).to.equal(false);
      });

    cy
      .get('.patient-interactions__empty')
      .should('be.visible');

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();

    cy
      .get('.patient-interactions__filters [data-filter="appointments"]')
      .click();

    cy
      .get('.patient-interactions__filters [data-filter="visits"]')
      .click();

    cy
      .get('.patient-interactions__empty')
      .should('be.visible');

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .wait('@callInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[channel]').split(',')).to.have.members(['voice', 'voicemail', 'video']);
      });

    cy
      .get('.patient-interactions__item')
      .should('have.length', 1)
      .and('contain', 'Left a message asking the patient to call back.');

    const carePlanMessage = getInteraction({
      attributes: {
        channel: 'sms',
        metadata: {
          message: 'Your care plan is available in the patient portal.',
        },
      },
    });

    const filtered = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(filtered);
    let filteredStarted = false;
    const filteredResponse = new Cypress.Promise(resolve => {
      filtered.release = resolve;
    });

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const channels = new URL(req.url).searchParams.get('filter[channel]');
        if (channels?.includes('voice')) {
          filteredStarted = true;
          filtered.drain = filteredResponse.then(() => {
            req.reply({ body: { data: [interaction], included: [action] } });
          });
          return filtered.drain;
        }
        req.alias = 'carePlanMessages';
        req.reply({ body: { data: [carePlanMessage] } });
      });

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();

    cy
      .get('.patient-interactions-loading[role="status"]')
      .should('be.visible')
      .should(() => {
        expect(filteredStarted).to.equal(true);
      });

    cy
      .get('.js-paging-loading')
      .should('not.be.visible');

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .wait('@carePlanMessages')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[channel]').split(',')).to.have.members(['sms', 'email', 'mail', 'fax', 'portal']);
      });

    cy
      .get('.patient-interactions__item')
      .should('have.length', 1)
      .and('contain', 'Your care plan is available in the patient portal.')
      .then(() => {
        filtered.release();
      });

    cy
      .then(() => Cypress.Promise.all([filtered.drain, ...requestCompletions]));

    cy
      .get('.patient-interactions__item')
      .should('have.length', 1)
      .and('contain', 'Your care plan is available in the patient portal.');

    cy
      .focused()
      .should('have.attr', 'data-filter', 'calls');

    cy
      .get('.patient-interactions [role="alert"]')
      .should('not.be.visible');

    const dateFilter = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(dateFilter);
    let dateFilterStarted = false;
    const dateFilterResponse = new Cypress.Promise(resolve => {
      dateFilter.release = resolve;
    });

    cy
      .routePatientInteractions(fx => {
        fx.data = [];
        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') === '3' || dateFilterStarted) return;
        dateFilterStarted = true;
        dateFilter.drain = dateFilterResponse.then(() => {
          req.reply({ body: { data: [] } });
        });
        return dateFilter.drain;
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .get('.patient-interactions-loading')
      .should('be.visible')
      .should(() => {
        expect(dateFilterStarted).to.equal(true);
      });

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click();

    cy
      .get('.picklist')
      .should('be.visible')
      .then(() => {
        dateFilter.release();
      });

    cy
      .then(() => Cypress.Promise.all([dateFilter.drain, ...requestCompletions]));

    cy
      .get('.patient-interactions__empty')
      .should('be.visible');

    cy
      .contains('.js-picklist-item', 'Today')
      .should('be.visible')
      .click();

    cy
      .get('.patient-interactions__empty')
      .should('be.visible');

    cy
      .routePatientInteractions(fx => {
        fx.data = [carePlanMessage];
        return fx;
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .contains('.patient-interactions__item', 'Your care plan is available in the patient portal.')
      .should('be.visible');

    const dateIntent = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(dateIntent);
    let dateIntentStarted = false;
    const dateIntentResponse = new Cypress.Promise(resolve => {
      dateIntent.release = resolve;
    });

    cy
      .routePatientInteractions(fx => {
        fx.data = [];
        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') === '3' || dateIntentStarted) return;
        dateIntentStarted = true;
        dateIntent.drain = dateIntentResponse.then(() => {
          req.reply({ body: { data: [] } });
        });
        return dateIntent.drain;
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .get('.patient-interactions-loading')
      .should('be.visible')
      .should(() => {
        expect(dateIntentStarted).to.equal(true);
      });

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click();

    cy
      .contains('.js-picklist-item', 'Yesterday')
      .click();

    cy
      .get('.patient-interactions__empty')
      .should('be.visible')
      .then(() => {
        dateIntent.release();
      });

    cy
      .then(() => Cypress.Promise.all([dateIntent.drain, ...requestCompletions]));

    cy
      .get('.patient-interactions__empty')
      .should('be.visible');

    cy
      .get('.patient-interactions .js-paging-loading')
      .should('have.attr', 'hidden');

    cy
      .routePatientInteractions(fx => {
        fx.data = [carePlanMessage];
        return fx;
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .contains('.patient-interactions__item', 'Your care plan is available in the patient portal.')
      .should('be.visible');

    const leaving = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(leaving);
    let leavingStarted = false;
    const leavingResponse = new Cypress.Promise(resolve => {
      leaving.release = resolve;
    });

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') === '3') {
          req.reply({ body: { data: [interaction], included: [action] } });
          return;
        }
        leavingStarted = true;
        leaving.drain = leavingResponse.then(() => {
          req.reply({ body: { data: [interaction], included: [action] } });
        });
        return leaving.drain;
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .get('.patient-interactions-loading[role="status"]')
      .should('be.visible')
      .should(() => {
        expect(leavingStarted).to.equal(true);
      });

    cy
      .get('.patient-pages .js-workflow')
      .click();

    cy
      .get('.patient-pages .js-interactions')
      .should('be.visible')
      .then(() => {
        leaving.release();
      });

    cy
      .then(() => Cypress.Promise.all([leaving.drain, ...requestCompletions]));

    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/workflow`);

    cy
      .get('.patient-interactions')
      .should('not.exist');

    cy
      .get('.alert-box')
      .should('not.exist');

    cy
      .routePatientInteractions(fx => {
        fx.data = [carePlanMessage];
        return fx;
      });

    cy
      .get('.patient-pages .js-interactions')
      .click();

    cy
      .contains('.patient-interactions__item', 'Your care plan is available in the patient portal.')
      .should('be.visible');

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') === '3') {
          req.reply({ body: { data: [carePlanMessage] } });
          return;
        }
        req.alias = 'failedTimeline';
        req.reply({ statusCode: 422, body: { errors: [{ title: 'Unavailable' }] } });
      })
      .visit(`/patient/${ patient.id }/interactions`);

    cy
      .wait('@failedTimeline');

    cy
      .get('.patient-interactions [role="alert"]')
      .should('contain', 'Interactions could not be loaded.');

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click();

    cy
      .contains('.js-picklist-item', 'Yesterday')
      .click();

    cy
      .get('.patient-interactions [role="alert"]')
      .should('contain', 'Interactions could not be loaded.');

    cy
      .get('.patient-interactions .js-paging-loading')
      .should('have.attr', 'hidden');

    cy
      .routePatientInteractions(fx => {
        fx.data = [carePlanMessage];
        return fx;
      });

    cy
      .get('.patient-interactions__status .js-retry')
      .should('be.visible')
      .click();

    cy
      .contains('.patient-interactions__item', 'Your care plan is available in the patient portal.')
      .should('be.visible');

    cy
      .get('.patient-pages .js-workflow')
      .click();

    cy
      .routePatientInteractions(fx => {
        fx.data = [carePlanMessage];
        return fx;
      });

    cy
      .get('.patient-pages .js-interactions')
      .click();

    cy
      .contains('.patient-interactions__item', 'Your care plan is available in the patient portal.')
      .should('be.visible');

    cy
      .viewport(1280, 900);

    const preview = { drain: Cypress.Promise.resolve() };
    pendingResponses.push(preview);
    let previewStarted = false;
    const previewResponse = new Cypress.Promise(resolve => {
      preview.release = resolve;
    });

    cy
      .routesForDefault()
      .intercept('GET', '/api/patients/*/interactions*', req => {
        previewStarted = true;
        preview.drain = previewResponse.then(() => {
          req.reply({ body: { data: [interaction], included: [action] } });
        });
        return preview.drain;
      })
      .visit(`/patient/${ patient.id }/workflow`, {
        onBeforeLoad(win) {
          const originalFetch = win.fetch.bind(win);
          restoreFetch = () => {
            win.fetch = originalFetch;
          };
          win.fetch = (...args) => {
            const request = originalFetch(...args);
            if (String(args[0]).includes('/interactions')) {
              requestCompletions.push(request.then(() => undefined, () => undefined));
            }
            return request;
          };
        },
      });

    cy
      .get('.patient-interactions-preview [role="status"]')
      .should('be.visible')
      .should(() => {
        expect(previewStarted).to.equal(true);
      });

    cy
      .get('.patient-interactions-preview .patient-interactions-loading__card')
      .should('be.visible');

    cy
      .get('.app-nav__content .app-nav__link')
      .first()
      .click();

    cy
      .location('pathname')
      .should('include', '/worklist/');

    cy
      .get('.patient-interactions-preview')
      .should('not.exist')
      .then(() => {
        preview.release();
      });

    cy
      .then(() => Cypress.Promise.all([preview.drain, ...requestCompletions]));

    cy
      .get('.patient-interactions-preview')
      .should('not.exist');

    cy
      .get('.alert-box')
      .should('not.exist');

    cy
      .routePatientInteractions(fx => {
        fx.data = [carePlanMessage];
        return fx;
      })
      .go('back');

    cy
      .get('.patient-interactions-preview__link')
      .should('contain', 'Outbound Message')
      .click();

    cy
      .contains('.patient-interactions__item', 'Your care plan is available in the patient portal.')
      .should('be.visible');

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click();

    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();

    cy
      .get('.patient-interactions__calendar-modal')
      .should('be.visible')
      .and('be.focused');

    const teardownFocus = [];
    const onTeardownFocus = event => {
      if (event.target.classList.contains('patient-interactions__date-button')) teardownFocus.push(event.target);
    };

    cy
      .window()
      .then(win => {
        win.document.addEventListener('focusin', onTeardownFocus);
      });

    cy
      .go('back');

    cy
      .get('.patient-pages .js-interactions')
      .should('be.visible');

    cy
      .get('.patient-interactions__calendar-modal')
      .should('not.exist');

    cy
      .window()
      .then(win => {
        win.document.removeEventListener('focusin', onTeardownFocus);
        expect(teardownFocus).to.have.length(0);
      });
  });
});
