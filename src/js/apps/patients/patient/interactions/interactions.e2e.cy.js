import { contains, filter, map, range } from 'underscore';
import { getRelationship } from 'helpers/json-api';
import formatDate from 'helpers/format-date';
import { getAction } from 'support/api/actions';
import { getInteraction, getPage } from 'support/api/interactions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';

function assertFeedEnd($item) {
  const container = $item.closest('.patient-interactions')[0];
  const list = $item.closest('.patient-interactions__list')[0];
  const padding = parseFloat(getComputedStyle(container).paddingBottom) + parseFloat(getComputedStyle(list).paddingBottom);
  expect(container.getAttribute('aria-busy'), 'feed request completed').to.equal('false');
  expect(container.scrollHeight - container.clientHeight - container.scrollTop, 'physical feed end').to.be.lessThan(2);
  expect(container.getBoundingClientRect().bottom - $item[0].getBoundingClientRect().bottom, 'only normal bottom spacing').to.be.at.most(padding + 1);
}

function createResponseGate(pendingResponses) {
  const drains = [];
  let release;
  const response = new Cypress.Promise(resolve => {
    release = resolve;
  });
  const gate = {
    started: false,
    release,
    get drain() {
      return Cypress.Promise.all(drains);
    },
    reply(request, body) {
      this.started = true;
      const drain = response.then(() => request.reply({ body }));
      drains.push(drain);
      return drain;
    },
  };
  pendingResponses.push(gate);
  return gate;
}

function trackInteractionRequests(win, completions, restores) {
  const originalFetch = win.fetch;
  restores.push(() => {
    win.fetch = originalFetch;
  });
  win.fetch = (...args) => {
    if (!String(args[0]).includes('/interactions')) return originalFetch.apply(win, args);
    let complete;
    completions.push(new Cypress.Promise(resolve => {
      complete = resolve;
    }));
    // Use the runner's task queue (unaffected by AUT clocks or later visits).
    // After JSON decoding, application Promise continuations drain before this task.
    const settled = () => setTimeout(complete, 0);
    const trackResponse = response => {
      const originalClone = response.clone.bind(response);
      const originalJson = response.json.bind(response);
      response.clone = () => trackResponse(originalClone());
      response.json = () => {
        const body = originalJson();
        body.then(settled, settled);
        return body;
      };
      if (response.status === 204) settled();
      return response;
    };
    return originalFetch.apply(win, args).then(trackResponse, error => {
      settled();
      throw error;
    });
  };
}

function drainInteractionRequests(completions) {
  const count = completions.length;
  return Cypress.Promise.all(completions).then(() => {
    if (completions.length !== count) return drainInteractionRequests(completions);
  });
}

context('patient interactions', function() {
  let pendingResponses;
  let requestCompletions;
  let restoreFetches;

  beforeEach(function() {
    pendingResponses = [];
    requestCompletions = [];
    restoreFetches = [];
    cy.on('window:before:load', win => trackInteractionRequests(win, requestCompletions, restoreFetches));

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
    return Cypress.Promise.all([drainInteractionRequests(requestCompletions), ...pendingResponses.map(response => response.drain)]).finally(() => {
      for (const restore of restoreFetches) restore();
    });
  });

  specify('limits anchored one-item pages with included and filtered-out pivots', function() {
    const data = map(range(5), index => ({
      id: `row-${ index }`,
      attributes: { occurred_at: `2026-10-08T0${ index }:00:00Z` },
    }));
    const query = new URLSearchParams({ 'page[at]': 'row-3', 'page[limit]': '1' });

    expect(map(getPage(data, query, data), 'id')).to.deep.equal(['row-3']);
    expect(map(getPage(filter(data, item => item.id !== 'row-3'), query, data), 'id')).to.deep.equal(['row-4']);

    query.set('page[at]', 'row-4');
    expect(getPage(data.slice(0, 4), query, data)).to.deep.equal([]);
  });

  specify('renders appointment statuses, cancellation reasons, and valid durations', function() {
    const patient = getPatient();
    const durations = [20, '15', 20, 0, null, '0', -1, '20', undefined, '', ' ', 'invalid', '-1'];
    const durationLabels = ['20 min', '15 min', '20 min', '0 min', '', '0 min', '', '20 min', '', '', '', '', ''];
    const appointments = map(['scheduled', 'completed', 'scheduled', 'scheduled', 'scheduled', 'checked_in', 'rescheduled', 'unknown', 'cancelled', 'scheduled', 'scheduled', 'scheduled', 'scheduled'], (status, index) => {
      const timestamp = index === 4 ? '2026-10-06T16:40:00Z' : '2026-10-08T19:00:00Z';
      const interaction = getInteraction({
        attributes: {
          channel: 'appointment',
          metadata: {
            status,
            appointment_type: `Clinic - Initial Visit (${ index })`,
            duration_minutes: durations[index],
            provider: 'UHP-Bundu',
            department: 'UHP_MD-HDG',
            timezone: 'America/Chicago',
            ...([2, 4].includes(index) && {
              cancel_reason: 'Patient request',
            }),
          },
          cancelled_at: [2, 4].includes(index) ? '2026-10-06T15:00:00Z' : null,
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

    const labels = ['scheduled', 'completed', 'cancelled', 'scheduled', 'cancelled', 'checked in', '', '', '', 'scheduled', 'scheduled', 'scheduled', 'scheduled'];
    for (const [index, label] of labels.entries()) {
      cy
        .contains('.patient-interactions__item', `Clinic - Initial Visit (${ index })`)
        .within(() => {
          cy
            .get('.patient-interactions__activity-description')
            .should('contain', 'Appointment')
            .and('contain', index === 4 ? '11:40 AM' : '2:00 PM')
            .and($description => {
              if (label) expect($description).to.contain(`Appointment ${ label }`);
              else expect($description.text()).not.to.match(/scheduled|completed|cancelled|checked in/);
            });

          cy
            .get('.patient-interactions__card')
            .should('contain', index === 4 ? 'Oct 6 at 11:40 AM' : 'Oct 8 at 2:00 PM')
            .and('contain', 'With UHP-Bundu at UHP_MD-HDG');

          cy
            .get('.patient-interactions__card')
            .should(durationLabels[index] ? 'contain' : 'not.contain', durationLabels[index] || ' min');

          cy
            .get('.patient-interactions__item-heading')
            .should('contain', `Clinic - Initial Visit (${ index })`)
            .and($heading => {
              expect($heading.text()).not.to.match(/scheduled|completed|cancelled|checked in/);
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

  specify('checks both history boundaries for a short linked feed', function() {
    const patient = getPatient();
    const interaction = getInteraction({ attributes: { metadata: { message: 'Only recorded interaction' } } });

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = [interaction];
        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (query.has('page[after]')) req.alias = 'shortFeedNewerBoundary';
        if (query.has('page[before]')) req.alias = 'shortFeedOlderBoundary';
      })
      .visit(`/patient/${ patient.id }/interactions/${ interaction.id }`);

    cy
      .wait('@shortFeedNewerBoundary')
      .then(({ request, response }) => {
        expect(new URL(request.url).searchParams.get('page[after]')).to.equal(interaction.id);
        expect(response.body.data).to.deep.equal([]);
      });

    cy
      .wait('@shortFeedOlderBoundary')
      .then(({ request, response }) => {
        expect(new URL(request.url).searchParams.get('page[before]')).to.equal(interaction.id);
        expect(response.body.data).to.deep.equal([]);
      });

    cy
      .get('.patient-interactions[aria-busy="false"] .patient-interactions__item')
      .should('have.length', 1)
      .and('contain', 'Only recorded interaction')
      .and('be.visible')
      .and('have.class', 'is-selected');
  });

  specify('shows an ongoing admission length of stay through today', function() {
    const patient = getPatient();
    const admission = getInteraction({
      attributes: {
        channel: 'visit',
        occurred_at: '2026-10-04T12:00:00Z',
        metadata: {
          facility: 'General Hospital',
          patient_class: 'inpatient',
          admitted_at: '2026-10-04T12:00:00Z',
          discharged_at: null,
        },
      },
    });

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = [admission];
        return fx;
      })
      .visitOnClock(`/patient/${ patient.id }/interactions`, { now: '2026-10-06T12:00:00Z', functionNames: ['Date'] });

    cy
      .contains('.patient-interactions__item', 'General Hospital')
      .scrollIntoView()
      .should('be.visible')
      .find('.patient-interactions__card')
      .should('contain', `Admitted ${ formatDate(admission.attributes.metadata.admitted_at, 'SHORT') }`)
      .and('contain', 'No discharge received')
      .and('contain', 'LOS 2 days');
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

        for (const [label, timestamp] of [['Admitted', flowInteraction.attributes.metadata.admitted_at], ['Discharged', flowInteraction.attributes.metadata.discharged_at]]) {
          cy
            .contains('.patient-interactions__detail', label)
            .should('contain', `${ label } ${ formatDate(timestamp, 'DATE') } at ${ formatDate(timestamp, 'TIME') }`);
        }
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
      .should('equal', `/one/patient/${ patient.id }/flow/${ flow.id }/action/${ action.id }`);

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
      .should('equal', `/one/patient/${ patient.id }/flow/${ dischargeFlow.id }`);

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

    const initial = createResponseGate(pendingResponses);

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        const channels = query.get('filter[channel]');
        const body = { data: [...grouped].reverse(), included: [flow, dischargeFlow, action, otherAction] };
        if (!channels && !initial.started) {
          return initial.reply(req, body);
        }
        if (channels) body.data = body.data.filter(item => channels.split(',').includes(item.attributes.channel));
        body.data = getPage(body.data, query, grouped);
        req.reply({ body });
      })
      .as('initialInteractions')
      .visit(`/patient/${ patient.id }/interactions`);

    cy
      .get('.patient-interactions-loading[role="status"]')
      .should('be.visible')
      .should(() => {
        expect(initial.started).to.equal(true);
      });

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .should('not.be.visible');

    cy
      .get('.patient-interactions-loading[role="status"]')
      .should('be.visible')
      .and('have.css', 'opacity', '1')
      .and('have.css', 'animation-name', 'none');

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .contains('.patient-interactions__item', 'Grouped message 10')
      .should('be.visible');

    cy
      .get('.patient-interactions__toolbar-date .js-date-button')
      .should('be.visible')
      .then(() => {
        initial.release();
      });

    cy
      .then(() => Cypress.Promise.all([initial.drain, drainInteractionRequests(requestCompletions)]));

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
      .contains('.patient-interactions__item', 'Grouped message 2')
      .should('exist');

    cy
      .contains('.patient-interactions__item', 'Grouped message 10')
      .should('exist');

    cy
      .contains('.patient-interactions__item', 'Grouped message 0')
      .should('have.class', 'patient-interactions__item--continues');

    cy
      .contains('.patient-interactions__item', /Grouped message 1(?!\d)/)
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
        .contains('.patient-interactions__item', new RegExp(`Grouped message ${ index }(?!\\d)`))
        .should('not.have.class', 'patient-interactions__item--continuation');
    }
    for (const index of [0, 1]) {
      cy
        .contains('.patient-interactions__item', new RegExp(`Grouped message ${ index }(?!\\d)`))
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
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[at]') === history[40].id) req.alias = 'historyTargetInteractions';
      })
      .visit(`/patient/${ patient.id }/interactions/${ history[40].id }`);

    cy
      .wait('@historyTargetInteractions')
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
          req.reply({ body: { data: getPage(history, query, history) } });
          return;
        }
        if (after) {
          req.alias = 'newerInteractions';
          req.reply({ body: { data: getPage(history, query, history) } });
          return;
        }
        req.alias = 'anchoredInteractions';
        req.reply({ body: { data: getPage(history, query, history) } });
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
      .should('be.visible')
      .should(assertFeedEnd);

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

    const expectedBoundary = history[22];
    expectedBoundary.attributes.expected_at = expectedBoundary.attributes.occurred_at;
    expectedBoundary.attributes.occurred_at = null;

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

  specify('starts plain arrival at Today and preserves the viewed range through filtering and empty results', function() {
    const patient = getPatient();
    const history = map(range(25), index => getInteraction({
      attributes: index < 11 ?
        {
          metadata: { message: `${ index < 10 ? 'Before today' : 'Today' } message ${ index }` },
          occurred_at: new Date(2026, 4, index < 10 ? 9 : 10, 10, index).toISOString(),
        } :
        {
          channel: 'appointment',
          metadata: { status: 'scheduled' },
          occurred_at: null,
          expected_at: new Date(2026, 4, 11, 10, index).toISOString(),
        },
    }));

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = history;
        return fx;
      })
      .visitOnClock(`/patient/${ patient.id }/interactions`, { now: new Date(2026, 4, 10, 12).toISOString(), functionNames: ['Date'] });

    cy
      .get('.patient-interactions[aria-busy="false"]')
      .should('be.visible');

    cy
      .get('.patient-interactions__toolbar-date')
      .should('contain', 'Today')
      .and('contain', 'May 10');

    cy
      .contains('.patient-interactions__item', 'Today message 10')
      .should('be.visible');

    const refresh = createResponseGate(pendingResponses);
    let position;

    cy
      .get('.patient-interactions')
      .then($feed => {
        position = { top: $feed[0].scrollTop, height: $feed[0].scrollHeight };
      });

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (refresh.started || query.get('page[limit]') !== '25' || !query.has('filter[channel]') || query.has('page[before]') || query.has('page[after]')) return;
        req.alias = 'heldFeedRefresh';
        const channels = query.get('filter[channel]').split(',');
        const data = filter(history, item => contains(channels, item.attributes.channel));
        return refresh.reply(req, { data: getPage(data, query, history) });
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click({ scrollBehavior: false });

    cy
      .get('.patient-interactions')
      .should('have.attr', 'aria-busy', 'true')
      .and($feed => {
        expect(refresh.started).to.equal(true);
        expect($feed[0].scrollTop, 'position retained during refresh').to.equal(position.top);
        expect($feed[0].scrollHeight, 'height retained during refresh').to.equal(position.height);
      })
      .scrollTo('top');

    cy
      .get('.patient-interactions .js-today')
      .should('have.attr', 'hidden')
      .then(() => {
        refresh.release();
      });

    cy
      .wait('@heldFeedRefresh');

    cy
      .get('.patient-interactions[aria-busy="false"]')
      .should('be.visible');

    cy
      .get('.patient-interactions__toolbar-date')
      .should('contain', 'Today')
      .and('contain', 'May 10');

    cy
      .contains('.patient-interactions__item', 'Today message 10')
      .should('be.visible');

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click({ scrollBehavior: false });

    cy
      .get('.patient-interactions__toolbar-date')
      .should('contain', 'May 11');

    cy
      .get('.patient-interactions__filters [data-filter="visits"]')
      .click({ scrollBehavior: false });

    cy
      .get('.patient-interactions__filters [data-filter="appointments"]')
      .click({ scrollBehavior: false });

    cy
      .get('.patient-interactions__empty')
      .should('be.visible');

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click({ scrollBehavior: false });

    cy
      .contains('.patient-interactions__item', 'Today message 10')
      .should('be.visible');
  });
});
