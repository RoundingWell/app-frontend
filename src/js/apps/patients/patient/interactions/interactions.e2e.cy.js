import { contains, filter, map, range } from 'underscore';

import { getRelationship } from 'helpers/json-api';
import formatDate from 'helpers/format-date';
import { createResponseGate, trackInteractionRequests, drainInteractionRequests } from 'helpers/interaction-requests';

import { getAction } from 'support/api/actions';
import { getInteraction, getPage } from 'support/api/interactions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getActivity } from 'support/api/events';
import { getComment } from 'support/api/comments';
import { getCurrentClinician } from 'support/api/clinicians';

function assertFeedEnd($item) {
  const container = $item.closest('.patient-interactions')[0];
  const list = $item.closest('.patient-interactions__list')[0];
  const padding = parseFloat(getComputedStyle(container).paddingBottom) + parseFloat(getComputedStyle(list).paddingBottom);
  expect(container.getAttribute('aria-busy'), 'feed request completed').to.equal('false');
  expect(container.scrollHeight - container.clientHeight - container.scrollTop, 'physical feed end').to.be.lessThan(2);
  expect(container.getBoundingClientRect().bottom - $item[0].getBoundingClientRect().bottom, 'only normal bottom spacing').to.be.at.most(padding + 1);
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

    cy
      .contains('.patient-interactions__item', 'Clinic - Initial Visit (0)')
      .find('.patient-interactions__marker use')
      .should('have.attr', 'href', '#far-fa-calendar-day');

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
            .get('.patient-interactions__activity-description strong')
            .should('have.text', 'Appointment');

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
          note: 'Outbound message fallback',
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

    const emptyMessage = getInteraction({
      attributes: { channel: 'sms', occurred_at: '2026-09-24T10:59:00Z', metadata: { note: null, disposition: 'Text Sent' } },
      relationships: { action: getRelationship(action) },
    });
    const emptyVisit = getInteraction({
      attributes: { channel: 'visit', occurred_at: '2026-09-24T10:01:00Z', metadata: null },
      relationships: { flow: getRelationship(dischargeFlow) },
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
        fx.data = [actionInteraction, flowInteraction, emptyMessage, emptyVisit];
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
          .get('.patient-interactions__marker use')
          .should('have.attr', 'href', '#far-fa-hospital');

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
      .should('contain', 'Alex Morgan')
      .and('not.contain', 'Outbound message fallback')
      .find('.patient-interactions__marker use')
      .should('have.attr', 'href', '#far-fa-paper-plane-top');

    cy
      .contains('.patient-interactions__activity-description', 'Outbound Message')
      .scrollIntoView()
      .should('be.visible')
      .closest('.patient-interactions__item')
      .within(() => {
        cy
          .contains('.js-action', 'Team Referral Flow: SMS Outreach')
          .should('be.visible');

        cy
          .get('.patient-interactions__card')
          .should('not.exist');
      });

    cy
      .get('.patient-interactions__item--visit time[datetime="2026-09-24T10:01:00Z"]')
      .closest('.patient-interactions__item')
      .scrollIntoView()
      .within(() => {
        cy
          .get('.patient-interactions__activity-description')
          .should('be.visible')
          .and('contain', 'Visit added');

        cy
          .contains('.js-action', 'TCM - ER Discharge')
          .should('be.visible');

        cy
          .get('.patient-interactions__card')
          .should('not.exist');
      });

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
      .and('contain', 'Inbound Message')
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
    const older = createResponseGate(pendingResponses);

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
        return older.reply(req, { data: getPage(history, new URL(req.url).searchParams, history) });
      })
      .visit(`/patient/${ patient.id }/interactions/${ history[67].id }`);

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
        expect(older.started).to.equal(true);
      });

    cy
      .get('.patient-interactions-preview__link')
      .last()
      .click({ scrollBehavior: false });

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Navigation message 79')
      .and('be.focused')
      .then(() => {
        older.release();
      });

    cy
      .then(() => Cypress.Promise.all([older.drain, drainInteractionRequests(requestCompletions)]));

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
          message: 'Outgoing message must not replace a patient reply.',
          note: 'Incoming message fallback',
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

    const olderPreview = getInteraction({
      attributes: {
        metadata: { note: 'Older fourth interaction' },
        occurred_at: '2026-09-22T10:00:00Z',
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
        fx.data = [olderPreview, interaction, sameDay, previousDay];
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
      getInteraction({ attributes: { channel: 'appointment', occurred_at: null, metadata: { appointment_type: 'Consultation' } } }),
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
      .get('.patient-interactions-preview__item--appointment')
      .find('time')
      .should('not.exist');

    const inheritedStatuses = map(['toString', 'constructor'], status => getInteraction({
      attributes: { channel: 'appointment', metadata: { status } },
    }));

    cy
      .routePatientInteractions(fx => {
        fx.data = inheritedStatuses;
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.patient-interactions-preview__title')
      .should('have.length', 2)
      .each($title => {
        expect($title.text()).to.equal('Appointment');
      });

    cy
      .routePatientInteractions(fx => {
        fx.data = [olderPreview, interaction, sameDay, previousDay];
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
      .get('.patient-interactions-preview__time')
      .should('have.length', 3)
      .and($times => {
        const timestamps = $times.toArray().map(time => time.getAttribute('datetime'));
        expect(timestamps).to.deep.equal([previousDay.attributes.occurred_at, sameDay.attributes.occurred_at, interaction.attributes.occurred_at]);
        expect(timestamps).not.to.include(olderPreview.attributes.occurred_at);
      });

    cy
      .get('.patient-interactions-preview__link')
      .last()
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
      .should('equal', `/one/patient/${ patient.id }/interactions/${ interaction.id }`);

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Outbound Call')
      .and('contain', 'Left Voicemail')
      .and('contain', 'Left a message asking the patient to call back.')
      .and('contain', 'Alex Morgan')
      .find('.patient-interactions__marker use')
      .should('have.attr', 'href', '#far-fa-phone-arrow-up-right');
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
      .should('contain', 'I can come in tomorrow morning.')
      .and('be.focused');

    cy
      .get('.patient-interactions[aria-busy="false"]')
      .should($el => {
        expect($el[0]).to.equal(timelineElement);
        expect(navigationRequests).to.equal(0);
      });

    cy
      .get('.patient-interactions-preview__link')
      .last()
      .click();

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Left a message asking the patient to call back.');

    cy
      .get('.patient-interactions-preview__all')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ patient.id }/interactions`);

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
      .last()
      .click();

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .should('have.attr', 'aria-pressed', 'true');

    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Left a message asking the patient to call back.')
      .and('be.focused');

    const targetFilter = createResponseGate(pendingResponses);

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (!query.has('filter[channel]') || query.get('page[limit]') === '3' || query.has('page[before]') || query.has('page[after]') || targetFilter.started) return;
        return targetFilter.reply(req, { data: [interaction, previousDay], included: [action] });
      });

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();

    cy
      .get('.patient-interactions[aria-busy="true"]')
      .should('be.visible')
      .should(() => {
        expect(targetFilter.started).to.equal(true);
      });

    cy
      .get('.patient-interactions-preview__link')
      .last()
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
      .then(() => Cypress.Promise.all([targetFilter.drain, drainInteractionRequests(requestCompletions)]));

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
      .should('contain', '+16155550101')
      .and('not.contain', 'Outgoing message must not replace a patient reply.')
      .and('not.contain', 'Incoming message fallback');

    cy
      .contains('.patient-interactions__item', 'Follow-up appointment.')
      .should('contain', 'Taylor Lee');

    cy
      .contains('.patient-interactions__item', 'Older fourth interaction')
      .should('exist');

    cy
      .get('.patient-interactions__date-divider')
      .should('have.length', 3);

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
      .and('be.focused')
      .trigger('keydown', { eventConstructor: 'KeyboardEvent', key: 'Tab', shiftKey: true });

    cy
      .focused()
      .should('have.class', 'js-next');

    cy
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'patient-interactions__calendar-close')
      .trigger('keydown', { eventConstructor: 'KeyboardEvent', key: 'Tab', shiftKey: true });

    cy
      .focused()
      .should('have.class', 'js-next');

    cy
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-prev');

    cy
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-next');

    cy
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'patient-interactions__calendar-close')
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
      .should('equal', `/one/patient/${ patient.id }/action/${ action.id }`);

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

    const undatedVisit = getInteraction({
      attributes: { channel: 'visit', occurred_at: null, metadata: { source: 'Visit details pending' } },
      relationships: { action: getRelationship(action) },
    });

    const inboundCall = getInteraction({
      attributes: {
        channel: 'voicemail',
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
    const videoCall = getInteraction({
      attributes: { channel: 'video', direction: 'outbound', metadata: { note: 'Video consultation completed.' } },
      relationships: { action: getRelationship(action) },
    });
    const email = getInteraction({
      attributes: { channel: 'email', direction: 'outbound', metadata: { note: 'Follow-up email instructions.', message: 'SMS-only content' } },
      relationships: { action: getRelationship(action) },
    });

    cy
      .routePatientInteractions(fx => {
        fx.data = [interaction, sameDay, previousDay, undatedAppointment, undatedVisit, inboundCall, missingMetadata, videoCall, email];
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
      .and('not.contain', 'Invalid Date')
      .find('time')
      .should('not.exist');

    cy
      .contains('.patient-action__activity .patient-interactions__item', 'Visit details pending')
      .find('time')
      .should('not.exist');

    cy
      .contains('.patient-action__activity .patient-interactions__item', 'Inbound callback')
      .should('contain', 'Inbound Voicemail')
      .find('.patient-interactions__marker use')
      .should('have.attr', 'href', '#far-fa-phone-arrow-down-left');

    cy
      .contains('.patient-action__activity .patient-interactions__item', 'Video consultation completed.')
      .should('contain', 'Outbound Video call');

    cy
      .contains('.patient-action__activity .patient-interactions__item', 'Follow-up email instructions.')
      .should('contain', 'via email')
      .and('not.contain', 'SMS-only content');

    cy
      .get('.patient-action__activity .patient-interactions__item--sms')
      .should('contain', 'Outbound Message')
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
      .should('equal', `/one/patient/${ patient.id }/interactions/${ interaction.id }`);

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
      .should('equal', `/one/patient/${ patient.id }/interactions`);

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
      .get('.patient-interactions__toolbar-date .js-date-button')
      .click();

    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();

    cy
      .get('.patient-interactions__calendar-modal')
      .should('be.visible')
      .find('.js-close')
      .click();

    cy
      .focused()
      .should('have.class', 'patient-interactions__date-button');

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
        expect([interaction.id, sameDay.id, previousDay.id]).to.include(query.get('page[at]'));
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

    const filtered = createResponseGate(pendingResponses);

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const channels = new URL(req.url).searchParams.get('filter[channel]');
        if (channels?.includes('voice')) {
          return filtered.reply(req, { data: [interaction], included: [action] });
        }
        req.alias = 'carePlanMessages';
        req.reply({ body: { data: [carePlanMessage] } });
      });

    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();

    cy
      .get('.patient-interactions[aria-busy="true"]')
      .should('be.visible')
      .should(() => {
        expect(filtered.started).to.equal(true);
      });

    cy
      .get('.js-paging-loading')
      .should('be.visible');

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
      .then(() => Cypress.Promise.all([filtered.drain, drainInteractionRequests(requestCompletions)]));

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

    const dateFilter = createResponseGate(pendingResponses);

    cy
      .routePatientInteractions(fx => {
        fx.data = [];
        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') === '3' || dateFilter.started) return;
        return dateFilter.reply(req, { data: [] });
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .get('.patient-interactions[aria-busy="true"]')
      .should('be.visible')
      .should(() => {
        expect(dateFilter.started).to.equal(true);
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
      .then(() => Cypress.Promise.all([dateFilter.drain, drainInteractionRequests(requestCompletions)]));

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

    const dateIntent = createResponseGate(pendingResponses);

    cy
      .routePatientInteractions(fx => {
        fx.data = [];
        return fx;
      })
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') === '3' || dateIntent.started) return;
        return dateIntent.reply(req, { data: [] });
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .get('.patient-interactions[aria-busy="true"]')
      .should('be.visible')
      .should(() => {
        expect(dateIntent.started).to.equal(true);
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
      .then(() => Cypress.Promise.all([dateIntent.drain, drainInteractionRequests(requestCompletions)]));

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

    const leaving = createResponseGate(pendingResponses);

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') === '3') {
          req.reply({ body: { data: [interaction], included: [action] } });
          return;
        }
        return leaving.reply(req, { data: [interaction], included: [action] });
      });

    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();

    cy
      .get('.patient-interactions[aria-busy="true"]')
      .should('be.visible')
      .should(() => {
        expect(leaving.started).to.equal(true);
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
      .then(() => Cypress.Promise.all([leaving.drain, drainInteractionRequests(requestCompletions)]));

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ patient.id }/workflow`);

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
      .routePatientInteractions(fx => {
        fx.data = [carePlanMessage];
        return fx;
      });

    cy
      .contains('.js-picklist-item', 'Yesterday')
      .click();

    cy
      .contains('.patient-interactions__item', 'Your care plan is available in the patient portal.')
      .should('be.visible');

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (new URL(req.url).searchParams.get('page[limit]') !== '25') return;
        req.alias = 'failedRetryTimeline';
        req.reply({ statusCode: 422, body: { errors: [{ title: 'Unavailable' }] } });
      })
      .visit(`/patient/${ patient.id }/interactions`);

    cy
      .wait('@failedRetryTimeline');

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

    const preview = createResponseGate(pendingResponses);

    cy
      .routesForDefault()
      .intercept('GET', '/api/patients/*/interactions*', req => {
        return preview.reply(req, { data: [interaction], included: [action] });
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.patient-interactions-preview [role="status"]')
      .should('be.visible')
      .should(() => {
        expect(preview.started).to.equal(true);
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
      .should('equal', '/one/worklist/owned-by');

    cy
      .get('.patient-interactions-preview')
      .should('not.exist')
      .then(() => {
        preview.release();
      });

    cy
      .then(() => Cypress.Promise.all([preview.drain, drainInteractionRequests(requestCompletions)]));

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
