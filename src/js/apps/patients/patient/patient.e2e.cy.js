import dayjs from 'dayjs';

import { getRelationship, getErrors, mergeJsonApi } from 'helpers/json-api';
import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getCurrentClinician } from 'support/api/clinicians';

// Legacy patient URL aliases with the end of their compatibility window.
const legacyAliases = {
  dashboard: { until: '2027-09-02', getPath: patientId => `/patient/dashboard/${ patientId }` },
  archive: { until: '2027-09-02', getPath: patientId => `/patient/archive/${ patientId }` },
  archiveAction: { until: '2027-09-02', getPath: (patientId, actionId) => `/patient/archive/${ patientId }/action/${ actionId }` },
};

context('patient page', function() {
  const testPatient = getPatient({
    attributes: {
      first_name: 'First',
      last_name: 'Last',
    },
  });

  specify('context trail', function() {
    cy
      .routesForPatientWorkflow()
      .routeActions()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient');

    cy
      .get('.patient__context-trail')
      .should('contain', 'First Last')
      .should('not.contain', 'Back to List');

    cy
      .get('.app-nav')
      .contains('Owned By')
      .click();

    cy
      .go('back')
      .wait('@routePatient');

    cy
      .get('.patient__context-trail')
      .should('contain', 'First Last')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'worklist/owned-by');
  });

  specify('can leave a workflow that failed to load', function() {
    const errorStub = cy.stub().as('readinessError');

    cy.on('uncaught:exception', error => {
      if (!error.message.includes('Error Status: 422')) return;

      errorStub(error);
      return false;
    });

    cy
      .routesForPatientWorkflow()
      .routeActions()
      .intercept('GET', '/api/patients/*/actions*', {
        statusCode: 422,
        body: { errors: getErrors({ status: '422', detail: 'Cannot load patient actions' }) },
      })
      .as('routeActionsError')
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routeActionsError');

    cy
      .get('@readinessError')
      .should('have.been.calledOnce');

    cy
      .get('.app-nav')
      .contains('Owned By')
      .click();

    cy
      .location('pathname')
      .should('equal', '/one/worklist/owned-by');

    cy
      .get('.list-page')
      .should('be.visible');
  });

  // Compatibility coverage for the three legacy patient URL aliases. They must
  // keep routing until September 2, 2027; delete this spec with the aliases.
  specify('legacy patient URL aliases still route', function() {
    const legacyAction = getAction({
      attributes: { name: 'Legacy Alias Action' },
      relationships: { patient: getRelationship(testPatient) },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeAction(fx => {
        fx.data = legacyAction;

        return fx;
      });

    // patient/dashboard/:patientId -> Open workflow
    cy
      .visit(legacyAliases.dashboard.getPath(testPatient.id))
      .wait('@routePatient');

    cy
      .get('.workflow-page__tab.is-selected')
      .contains('Open');

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`);

    // patient/archive/:patientId -> Closed workflow
    cy
      .visit(legacyAliases.archive.getPath(testPatient.id))
      .wait('@routePatient');

    cy
      .get('.workflow-page__tab.is-selected')
      .contains('Closed');

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow/closed`);

    // patient/archive/:patientId/action/:actionId -> Action
    cy
      .visit(legacyAliases.archiveAction.getPath(testPatient.id, legacyAction.id))
      .wait('@routeAction');

    cy
      .get('.patient-action__name')
      .should('contain', 'Legacy Alias Action');

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ legacyAction.id }`);
  });

  specify('legacy patient URL aliases are removed after their compatibility window', function() {
    expect(Object.keys(legacyAliases)).to.have.length(3);

    Object.entries(legacyAliases).forEach(([name, { until }]) => {
      expect(dayjs().isAfter(dayjs(until).endOf('day')), `alias ${ name } is past ${ until }; remove it and this spec`).to.be.false;
    });
  });

  specify('legacy flow URLs resolve to the patient flow routes', function() {
    const legacyFlow = getFlow({
      relationships: { patient: getRelationship(testPatient) },
    });
    const legacyFlowAction = getAction({
      relationships: {
        flow: getRelationship(legacyFlow),
        patient: getRelationship(testPatient),
      },
    });
    const patientFlowPath = `/one/patient/${ testPatient.id }/flow/${ legacyFlow.id }`;

    cy
      .routesForPatientAction()
      .routeActions()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlow(fx => {
        fx.data = mergeJsonApi(legacyFlow, {
          relationships: { patient: getRelationship(testPatient) },
        });
        fx.included = [testPatient];

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [legacyFlowAction];

        return fx;
      })
      .routeFlowActivity()
      .routeAction(fx => {
        fx.data = legacyFlowAction;
        fx.included.push(legacyFlow);

        return fx;
      })
      .visit(`/flow/${ legacyFlow.id }`)
      .wait('@routeFlow');

    cy
      .location('pathname')
      .should('equal', patientFlowPath);

    cy
      .visit(`/flow/${ legacyFlow.id }/details`)
      .wait('@routeFlow');

    cy
      .location('pathname')
      .should('equal', patientFlowPath);

    cy
      .visit(`/flow/${ legacyFlow.id }/action/${ legacyFlowAction.id }`)
      .wait('@routeAction');

    cy
      .location('pathname')
      .should('equal', `${ patientFlowPath }/action/${ legacyFlowAction.id }`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .navigate(`/flow/${ legacyFlow.id }`);

    cy
      .location('pathname')
      .should('equal', patientFlowPath);

    cy.go('back');

    cy
      .location('pathname')
      .should('equal', '/one/worklist/owned-by');
  });

  specify('quickly routing from one patient to another renders only the latest', function() {
    let releaseFirstPatient;
    const firstPatientResponse = new Cypress.Promise(resolve => {
      releaseFirstPatient = resolve;
    });
    const firstPatient = getPatient({
      attributes: { first_name: 'First', last_name: 'Alpha' },
    });
    const secondPatient = getPatient({
      attributes: { first_name: 'Second', last_name: 'Bravo' },
    });

    cy
      .routesForPatientWorkflow()
      .routeActions()
      .intercept('GET', new RegExp(`/api/patients/${ firstPatient.id }\\?`), req => {
        return firstPatientResponse.then(() => {
          req.reply({ body: { data: firstPatient, included: [] } });
        });
      })
      .as('routeDelayedFirstPatient')
      .intercept('GET', new RegExp(`/api/patients/${ secondPatient.id }\\?`), {
        body: { data: secondPatient, included: [] },
      })
      .as('routeSecondPatient')
      .visit(`/patient/${ firstPatient.id }/workflow`);

    cy
      .get('@routeDelayedFirstPatient.all')
      .should('have.length', 1);

    cy
      .getRadio(Radio => {
        Radio.trigger('event-router', 'patient:workflow', secondPatient.id);
      })
      .wait('@routeSecondPatient')
      .wait('@routePatientActions');

    cy
      .get('.patient__context-trail')
      .should('contain', 'Second Bravo');

    cy
      .then(() => {
        releaseFirstPatient();
      })
      .wait('@routeDelayedFirstPatient');

    // A later round trip lets any stale first-patient activation finish before asserting.
    cy
      .getRadio(Radio => {
        Radio.trigger('event-router', 'patient:workflow:closed', secondPatient.id);
      })
      .wait('@routePatientActions');

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ secondPatient.id }/workflow/closed`);

    cy
      .get('.patient__context-trail')
      .should('contain', 'Second Bravo')
      .and('not.contain', 'First Alpha');

    cy
      .get('@routePatientActions.all')
      .then(interceptions => {
        const firstPatientRequests = interceptions.filter(({ request }) => request.url.includes(firstPatient.id));

        expect(firstPatientRequests).to.have.length(0);
      });
  });

  specify('uses drawer, collapsible, and fixed wide patient sidebar modes', function() {
    cy
      .viewport(720, 720)
      .routesForPatientWorkflow()
      .routeSettings('sidebar', ['demographics', 'care-plan', 'forms'])
      .routePanels(fx => {
        const [panel] = fx.data;

        fx.data.push({
          ...panel,
          id: 'care-plan-panel',
          attributes: {
            ...panel.attributes,
            slug: 'care-plan',
            name: 'Care Plan',
            widgets: ['dob'],
          },
        }, {
          ...panel,
          id: 'forms-panel',
          attributes: {
            ...panel.attributes,
            slug: 'forms',
            name: 'Forms',
            widgets: ['sex'],
          },
        });

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .type('{esc}');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy.viewport(1799, 720);

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'true')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy.viewport(1800, 720);

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'false')
      .click();

    cy.viewport(2239, 720);

    cy
      .get('.patient__sidebar-toggle')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy.viewport(2240, 720);

    cy
      .get('.patient__frame')
      .should('not.have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient-sidebar')
      .should($sidebar => {
        expect($sidebar[0].getBoundingClientRect().width).to.equal(580);
      });

    cy
      .get('.patient-sidebar__cards')
      .find('.patient-sidebar__card')
      .should($cards => {
        const first = $cards[0].getBoundingClientRect();
        const second = $cards[1].getBoundingClientRect();
        const third = $cards[2].getBoundingClientRect();

        expect(first.height).to.be.greaterThan(second.height);
        expect(first.top).to.equal(second.top);
        expect(second.left).to.equal(first.right + 16);
        expect(third.left).to.equal(second.left);
        expect(third.top).to.equal(second.bottom + 16);
        expect(third.top).to.be.lessThan(first.bottom);
      });

    cy
      .get('.patient__sidebar-toggle')
      .should('not.be.visible');

    cy.viewport(2239, 720);

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'false');

    cy
      .viewport(2240, 720)
      .reload()
      .wait('@routePatient')
      .get('.patient__frame')
      .should('not.have.class', 'patient__frame--sidebar-hidden');
  });

  specify('patient routing', function() {
    cy
      .viewport(1920, 900)
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient');

    cy
      .get('.patient__layout')
      .find('.workflow-page__tab.is-selected')
      .contains('Open');

    cy
      .get('.workflow-page')
      .should($page => {
        expect($page[0].getBoundingClientRect().width).to.equal(1200);
      });

    cy
      .get('.patient__layout')
      .find('.js-workflow-closed')
      .click();

    cy
      .get('.patient__layout')
      .find('.workflow-page__tab.is-selected')
      .contains('Closed');

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow/closed`);

    cy
      .reload()
      .wait('@routePatient');

    cy
      .get('.patient__layout')
      .find('.workflow-page__tab.is-selected')
      .contains('Closed');

    cy
      .get('.patient__layout')
      .find('.js-workflow-open')
      .click();

    cy
      .get('.patient__layout')
      .find('.workflow-page__tab.is-selected')
      .contains('Open');
  });

  specify('remembers the patient sidebar across patients and reloads', function() {
    const otherPatient = getPatient();
    const currentClinician = getCurrentClinician();
    const preferenceKey = `isPatientSidebarHidden_${ currentClinician.id }`;

    cy
      .viewport(1280, 720)
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .get('.patient__sidebar-toggle')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy.window().then(win => {
      expect(JSON.parse(win.localStorage.getItem(preferenceKey))).to.be.true;
    });

    cy
      .routePatient(fx => {
        fx.data = otherPatient;

        return fx;
      })
      .visit(`/patient/${ otherPatient.id }/workflow`)
      .wait('@routePatient')
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .reload()
      .wait('@routePatient')
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .click();

    cy.window().then(win => {
      expect(JSON.parse(win.localStorage.getItem(preferenceKey))).to.be.false;
    });
  });
});
