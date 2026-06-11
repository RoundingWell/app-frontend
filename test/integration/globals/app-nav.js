import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import { getRelationship, getErrors } from 'helpers/json-api';

import { testTs } from 'helpers/test-timestamp';

import { workspaceOne, workspaceTwo, getWorkspace } from 'support/api/workspaces';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { roleAdmin, roleEmployee } from 'support/api/roles';
import { teamCoordinator } from 'support/api/teams';
import { testForm } from 'support/api/forms';

context('App Nav', function() {
  beforeEach(function() {
    cy.routesForDefault();
  });

  specify('display non-manager nav', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleEmployee),
          },
        });

        return fx;
      })
      .visit();

    cy
      .get('.app-nav')
      .find('.app-nav__bottom')
      .contains('Dashboards')
      .should('not.exist');

    cy
      .get('.app-nav')
      .find('.app-nav__bottom')
      .contains('Admin Tools')
      .should('not.exist');
  });

  specify('display nav', function() {
    cy
      .routeSettings('help_url', null)
      .routePrograms()
      .routeDashboards()
      .routeClinicians()
      .visit()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem('isNavMenuMinimized'));

        expect(storageItem).to.be.false;
      });

    cy
      .get('.app-nav__header')
      .should('contain', 'Workspace One')
      .should('contain', 'Clinician McTester')
      .as('mainNav');

    cy
      .get('@mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.app-nav__picklist-workspace-name')
      .should('contain', 'Cypress Clinic');

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('contain', 'Workspace One')
      .should('have.class', 'is-selected')
      .next()
      .should('contain', 'Workspace Two')
      .should('not.have.class', 'is-selected');

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Help & Support')
      .should('have.attr', 'href')
      .and('contain', 'help.roundingwell.com');

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Sign Out')
      .should('have.attr', 'href')
      .and('contain', '/logout');

    // NOTE: this closes the main nav droplist so it doesn't cover other nav links
    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .click();

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .as('worklists');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .click()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .last()
      .click()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .first()
      .click();

    cy
      .url()
      .should('contain', 'dashboards');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .last()
      .should('not.have.class', 'is-selected');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .contains('Admin Tools')
      .as('adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .click();

    cy
      .url()
      .should('contain', 'programs');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('@adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('.js-picklist-item')
      .eq(1)
      .click();

    cy
      .url()
      .should('contain', 'clinicians');

    cy
      .get('@adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('.js-picklist-item')
      .eq(1)
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .click();

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('@adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .last()
      .should('not.have.class', 'is-selected');
  });

  specify('switch workspaces', function() {
    cy
      .routeActions()
      .routeWorkspaces(fx => {
        fx.data = [
          getWorkspace({ attributes: { settings: { manual_patient_creation: true } } }, { id: workspaceOne.id }),
          getWorkspace({ attributes: { settings: { manual_patient_creation: false } } }, { id: workspaceTwo.id }),
        ];

        return fx;
      })
      .visit()
      .wait('@routeActions')
      .wait('@routeWorkspaces')
      .get('@routeWorkspaceClinicians')
      .its('request.headers')
      .should('have.property', 'workspace', workspaceOne.id)
      .then(() => {
        const storage = JSON.parse(localStorage.getItem('currentWorkspace'));

        expect(storage).to.equal(workspaceOne.id);
      });

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .get('.app-nav')
      .find('.js-add-patient');

    cy
      .get('.app-nav__header')
      .as('mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('have.class', 'is-selected')
      .next()
      .should('not.have.class', 'is-selected')
      .click();

    cy
      .wait('@routeActions')
      .its('request.headers')
      .should('have.property', 'workspace', workspaceTwo.id)
      .then(() => {
        const storage = JSON.parse(localStorage.getItem('currentWorkspace'));

        expect(storage).to.equal(workspaceTwo.id);
      });

    cy
      .url()
      .should('contain', '/two/worklist/owned-by');

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .should('not.exist');

    cy
      .get('.app-nav__header')
      .as('mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('not.have.class', 'is-selected')
      .next()
      .should('have.class', 'is-selected');

    cy
      .go('back');

    cy
      .wait('@routeActions')
      .its('request.headers')
      .should('have.property', 'workspace', workspaceOne.id)
      .then(() => {
        const storage = JSON.parse(localStorage.getItem('currentWorkspace'));

        expect(storage).to.equal(workspaceOne.id);
      });

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .get('.app-nav__header')
      .as('mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('have.class', 'is-selected')
      .next()
      .should('not.have.class', 'is-selected');
  });

  specify('minimized nav menu', function() {
    localStorage.setItem('isNavMenuMinimized', true);

    cy
      .routePrograms()
      .visit();

    cy
      .get('.app-nav__header')
      .should('not.contain', 'Workspace One')
      .should('not.contain', 'Clinician McTester');

    cy
      .get('.app-nav__header')
      .find('img')
      .should('have.attr', 'src', '/rwell-logo.svg');

    cy
      .get('.app-nav__header')
      .click()
      .get('.picklist');

    cy
      .get('.app-nav__header')
      .should('have.class', 'is-active');

    cy
      .get('.app-frame__content')
      .click('left');

    cy
      .get('[data-nav-content-region]')
      .find('.js-search')
      .should('not.contain', 'Search')
      .click();

    cy
      .get('.patient-search__modal')
      .find('.js-close')
      .click();

    cy
      .get('.app-nav__title')
      .should('not.exist');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .as('worklists');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .should('have.length', 6);

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .should('not.contain', 'Owned By')
      .should('not.contain', 'Schedule')
      .should('not.contain', 'Shared By')
      .should('not.contain', 'New < 1 Day')
      .should('not.contain', 'Updated < 3 Days')
      .should('not.contain', 'Done < 30 Days');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .should('have.length', 1)
      .should('not.contain', 'Dashboards');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .should('have.length', 3)
      .should('not.contain', 'Add Patient')
      .should('not.contain', 'Admin Tools')
      .should('not.contain', 'Minimize Menu');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .last()
      .find('.fa-square-caret-right');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .eq(1)
      .click();

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .eq(1)
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .last()
      .as('minimizeMenuButton')
      .click()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem('isNavMenuMinimized'));

        expect(storageItem).to.be.false;
      });

    cy
      .get('.app-nav__header')
      .should('contain', 'Workspace One')
      .should('contain', 'Clinician McTester');

    cy
      .get('[data-nav-content-region]')
      .find('.js-search')
      .should('contain', 'Search');

    cy
      .get('.app-nav__title')
      .should('exist');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .should('contain', 'Owned By')
      .should('contain', 'Schedule')
      .should('contain', 'Shared By')
      .should('contain', 'New < 1 Day')
      .should('contain', 'Updated < 3 Days')
      .should('contain', 'Done < 30 Days');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .should('have.length', 1)
      .should('contain', 'Dashboards');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .should('have.length', 3)
      .should('contain', 'Add Patient')
      .should('contain', 'Admin Tools')
      .should('contain', 'Minimize Menu');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .last()
      .find('.fa-square-caret-left');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .eq(1)
      .should('have.class', 'is-selected');

    cy
      .get('.app-nav')
      .find('.app-nav__bottom-button')
      .contains('Admin Tools')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@minimizeMenuButton')
      .click()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem('isNavMenuMinimized'));

        expect(storageItem).to.be.true;
      });

    cy
      .get('.app-nav')
      .find('.app-nav__bottom-button')
      .eq(1)
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .should('have.class', 'is-selected');
  });

  specify('add patient success', function() {
    const currentDate = dayjs();
    const pastDate = currentDate.subtract(10, 'years');

    const testNewPatientId = uuid();

    const testClinician = getClinician({
      attributes: {
        name: 'Test Clinician',
        email: 'test.clinician@roundingwell.com',
        enabled: true,
        last_active_at: testTs(),
      },
      relationships: {
        team: getRelationship(teamCoordinator),
        workspaces: getRelationship([workspaceOne]),
        role: getRelationship(roleAdmin),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeSettings('patient_creation_form', null)
      .routeWorkspaceClinicians(fx => {
        fx.data = [testClinician];

        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data = testClinician;

        return fx;
      })
      .visit('/', { isRoot: true });

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('.modal')
      .as('addPatientModal')
      .should('contain', 'Add Patient');

    cy
      .get('@addPatientModal')
      .contains('First Name')
      .parent()
      .find('.js-input')
      .type('First{enter}');

    cy
      .get('@addPatientModal')
      .contains('Last Name')
      .parent()
      .find('.js-input')
      .type('Last{enter}');

    cy
      .get('@addPatientModal')
      .contains('Date of Birth')
      .parent()
      .find('.date-select__button')
      .click();

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.format('MMMM'))
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.date())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region]')
      .should('contain', pastDate.format('MMM DD, YYYY'))
      .find('.date-select__button')
      .should('not.exist');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('@addPatientModal')
      .find('[data-sex-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .intercept('PUT', '/api/patients', {
        statusCode: 201,
        body: {
          data: {
            id: testNewPatientId,
            first_name: 'First',
            last_name: 'Last',
          },
        },
      })
      .as('routeAddPatient');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .click()
      .wait('@routeAddPatient')
      .wait('@routePatient');

    cy
      .url()
      .should('contain', `patient/dashboard/${ testNewPatientId }`);
  });

  specify('add patient failure', function() {
    const testDate = dayjs().year(2020).month(0).day(1).valueOf();
    const futureDate = dayjs(testDate).add(1, 'day');

    cy
      .visitOnClock({ now: testDate, functionNames: ['Date'] });

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('.modal')
      .as('addPatientModal')
      .find('.js-close .icon')
      .click();

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('@addPatientModal')
      .contains('First Name')
      .parent()
      .find('.js-input')
      .type('First');

    cy
      .get('@addPatientModal')
      .contains('Last Name')
      .parent()
      .find('.js-input')
      .type('Last');

    cy
      .get('@addPatientModal')
      .contains('Date of Birth')
      .parent()
      .find('.date-select__button')
      .click();

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.format('MMMM'))
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.date())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-sex-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('.modal__error')
      .should('contain', 'Date of birth cannot be in the future');

    cy
      .get('@addPatientModal')
      .find('.date-select__date')
      .should('have.class', 'has-error');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .js-cancel')
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.subtract(10, 'years').year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-info-region]')
      .should('be.empty');

    cy
      .get('@addPatientModal')
      .find('.date-select__date')
      .should('not.have.class', 'has-error');

    cy
      .intercept('PUT', '/api/patients', {
        statusCode: 400,
        body: {
          errors: getErrors({
            status: '400',
            title: 'Bad Request',
            detail: 'Similar patient exists',
          }),
        },
      })
      .as('routeSimilarPatientError');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .click()
      .wait('@routeSimilarPatientError');

    cy
      .get('@addPatientModal')
      .find('.modal__error')
      .should('contain', 'Similar patient exists');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('@addPatientModal')
      .find('[data-first-name-region] .js-input')
      .should('have.class', 'has-error');

    cy
      .get('@addPatientModal')
      .find('[data-last-name-region] .js-input')
      .should('have.class', 'has-error')
      .clear()
      .type('New Last');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .click()
      .wait('@routeSimilarPatientError');

    cy
      .get('@addPatientModal')
      .find('.modal__error .js-search')
      .click();

    cy
      .get('.patient-search__modal')
      .find('.patient-search__input')
      .should('have.value', 'First New Last');

    cy
      .get('.patient-search__modal')
      .find('.js-close .icon')
      .click();

    cy
      .get('.patient-search__modal')
      .should('not.exist');
  });

  specify('manual add patient disabled', function() {
    cy
      .routeSettings('manual_patient_creation', false)
      .visit();

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .should('not.exist');
  });

  specify('hidden help link', function() {
    cy
      .routeSettings('help_url', false)
      .visit();

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Help & Support')
      .should('not.exist');
  });

  specify('custom help link url', function() {
    cy
      .visit();

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Help & Support')
      .should('have.attr', 'href')
      .and('contain', 'customer-help-url.com');
  });

  specify('add patient custom form', function() {
    const testNewPatientId = uuid();

    cy
      .routeSettings('patient_creation_form', {
        form_id: testForm.id,
        submit_text: `Continue to ${ testForm.attributes.name }`,
      })
      .visit();

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('.modal')
      .as('addPatientModal')
      .contains('First Name')
      .parent()
      .find('.js-input')
      .type('First');

    cy
      .get('@addPatientModal')
      .contains('Last Name')
      .parent()
      .find('.js-input')
      .type('Last');

    cy
      .get('@addPatientModal')
      .contains('Date of Birth')
      .parent()
      .find('.date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(dayjs().subtract(1, 'years').year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-sex-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .routePatient(fx => {
        fx.data.id = testNewPatientId;

        return fx;
      })
      .routeWorkspacePatient()
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields()
      .routeLatestFormResponse()
      .intercept('PUT', '/api/patients', {
        statusCode: 201,
        body: {
          data: {
            id: testNewPatientId,
            first_name: 'First',
            last_name: 'Last',
          },
        },
      })
      .as('routeAddPatient');

    cy
      .get('@addPatientModal')
      .contains(`Continue to ${ testForm.attributes.name }`)
      .click()
      .wait('@routeAddPatient');

    cy
      .url()
      .should('contain', `/patient/${ testNewPatientId }/form/${ testForm.id }`);

    cy
      .wait('@routePatient')
      .wait('@routeWorkspacePatient')
      .wait('@routeForm')
      .wait('@routeLatestFormResponse')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields');
  });
});
