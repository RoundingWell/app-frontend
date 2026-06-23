import _ from 'underscore';

import { getRelationship, getResource } from 'helpers/json-api';

import { getPatient } from 'support/api/patients';

context('Patient Quick Search', function() {
  specify('Modal & default searching functionality', function() {
    const patients = _.times(10, index => {
      return getPatient({
        attributes: {
          first_name: 'Test',
          last_name: `${ index } Patient`,
          birth_date: '2008-01-16',
          status: index % 2 ? 'inactive' : 'active',
        },
      });
    });

    const searchResults = _.map(patients, patient => {
      const { first_name, last_name, birth_date, status } = patient.attributes;

      return {
        id: patient.id,
        type: 'patient-search-results',
        attributes: {
          first_name,
          last_name,
          birth_date,
          status,
          match: {
            label: 'Name',
            value: `${ first_name } ${ last_name }`,
          },
        },
        relationships: {
          patient: getRelationship(patient, 'patients'),
        },
      };
    });

    cy
      .intercept({
        method: 'GET',
        url: '/api/patients?filter*',
      }, req => {
        if (req.url.includes('None')) {
          req.reply({ body: { data: [] } });
          req.alias = 'routeEmptyPatientSearch';
          return;
        }
        req.reply({
          body: {
            data: searchResults,
            included: [...getResource(patients, 'patients')],
          },
          delay: 300,
        });
        req.alias = 'routePatientSearch';
      });

    cy
      .routesForPatientDashboard()
      .routeSettings('manual_patient_creation', false)
      .routeActions()
      .visit()
      .wait('@routeActions');

    cy
      .get('.app-frame__nav')
      .find('.js-search')
      .as('search')
      .click();

    cy
      .get('@search')
      .should('have.class', 'is-active');

    cy
      .get('.patient-search__modal')
      .as('searchModal')
      .should('contain', 'Search by')
      .find('.patient-search__input')
      .should('have.attr', 'placeholder', 'Search for patients');

    cy
      .get('@searchModal')
      .find('.qa-search-option')
      .should('have.length', 4);

    cy
      .get('@searchModal')
      .find('.qa-search-option')
      .first()
      .should('contain', 'Date of Birth')
      .should('contain', 'For example: MM/DD/YYYY');

    cy
      .get('@searchModal')
      .find('.qa-search-option')
      .eq(1)
      .should('contain', 'Medical Record Number')
      .should('contain', 'For example: A234567');

    cy
      .get('@searchModal')
      .find('.qa-search-option')
      .eq(2)
      .should('contain', 'Health Plan ID')
      .should('contain', 'For example: 123456789');

    cy
      .get('@searchModal')
      .find('.qa-search-option')
      .last()
      .should('contain', 'Phone Number')
      .should('contain', 'For example: 555-1290');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type('Test');

    cy
      .wait('@routePatientSearch')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[search]=Test');

    cy
      .get('@searchModal')
      .find('.js-picklist-item')
      .should('have.length', 10);

    cy
      .get('@searchModal')
      .find('.js-picklist-item')
      .first()
      .should('not.have.class', 'is-inactive')
      .next()
      .should('have.class', 'is-inactive');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type(' 2')
      .wait('@routePatientSearch')
      .wait(100); // wait for debounce

    cy
      .get('@searchModal')
      .find('.js-picklist-item strong')
      .contains('2')
      .parents('.js-picklist-item')
      .find('.patient-search__picklist-item-meta')
      .should('contain', 'active')
      .should('not.contain', 'Patient')
      .should('not.contain', 'Name')
      .click();

    cy
      .url()
      .should('contain', `patient/dashboard/${ patients[2].id }`);

    cy
      .get('@search')
      .click();

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type('None')
      .wait('@routeEmptyPatientSearch');

    cy
      .get('@searchModal')
      .should('contain', 'No results match your query')
      .should('not.contain', 'Add Patient');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .clear();

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type('   ');

    cy
      .get('@searchModal')
      .should('contain', 'No results match your query');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .clear();

    cy
      .get('@searchModal')
      .should('contain', 'Search by');

    cy
      .get('@searchModal')
      .find('.js-close')
      .click();

    cy
      .get('@searchModal')
      .should('not.exist');

    cy
      .get('.app-nav')
      .find('.app-nav__bottom-button')
      .contains('Admin Tools')
      .click();

    cy
      .get('.js-picklist-item')
      .contains('Programs')
      .click();

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .first()
      .click()
      .wait('@routeActions');

    cy
      .get('body')
      .type('/');

    cy
      .get('@searchModal')
      .should('contain', 'Search by');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type('Tes')
      .wait(200)
      .type('ting')
      .wait('@routePatientSearch')
      .wait(100); // wait for debounce

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type('{backspace}{backspace}{backspace}{backspace}{backspace}');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type('s')
      .wait('@routePatientSearch');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .type('{leftArrow}{backspace}{backspace}')
      .wait(100); // wait for debounce

    cy
      .get('@searchModal')
      .should('contain', 'Search by');

    cy.intercept({
      method: 'GET',
      url: '/api/patients?filter*',
    }, {
      body: {
        data: [{
          ...searchResults[0],
          attributes: { ...searchResults[0].attributes, match: { label: 'Birth Date', value: '2008-01-16' } },
        }],
        included: [getResource(patients[0], 'patients')],
      },
      delay: 300,
    }).as('routePatientSearch');

    cy
      .get('@searchModal')
      .find('.patient-search__input')
      .clear()
      .type('01/16/2008')
      .wait('@routePatientSearch');

    cy
      .get('@searchModal')
      .find('.js-picklist-item strong')
      .should('contain', '01/16/2008');

    cy
      .go('back');
  });

  specify('Search by identifier', function() {
    const testPatient = getPatient({
      attributes: {
        status: 'active',
        identifiers: [{ type: 'mrn', value: 'identifier-001' }],
      },
    });

    const { first_name, last_name, birth_date, status } = testPatient.attributes;

    const searchResult = {
      id: testPatient.id,
      type: 'patient-search-results',
      attributes: {
        first_name,
        last_name,
        birth_date,
        status,
        match: {
          label: 'MRN',
          value: '311300999',
        },
      },
      relationships: {
        patient: getRelationship(testPatient, 'patients'),
      },
    };

    cy.intercept({
      method: 'GET',
      url: '/api/patients?filter*',
    }, {
      body: {
        data: [searchResult],
        included: [getResource(testPatient, 'patients')],
      },
      delay: 300,
    }).as('routePatientSearch');

    cy
      .routesForPatientDashboard()
      .routeSettings('manual_patient_creation', false)
      .routeActions()
      .visit()
      .wait('@routeActions');

    cy
      .get('.app-frame__nav')
      .find('.js-search')
      .as('search')
      .click();

    cy
      .get('.patient-search__modal')
      .find('.patient-search__input')
      .type('311300999')
      .wait('@routePatientSearch');

    cy
      .get('.patient-search__modal')
      .find('.js-picklist-item strong')
      .should('contain', '311300999')
      .parents('.js-picklist-item')
      .should('contain', 'MRN');
  });

  specify('Search by patient field', function() {
    const testPatient = getPatient({
      attributes: {
        status: 'active',
        birth_date: '2008-01-16',
      },
    });

    const { first_name, last_name, birth_date, status } = testPatient.attributes;

    const searchResult = {
      id: testPatient.id,
      type: 'patient-search-results',
      attributes: {
        first_name,
        last_name,
        birth_date,
        status,
        match: {
          label: 'Phone Number',
          value: '+16513216543',
        },
      },
      relationships: {
        patient: getRelationship(testPatient, 'patients'),
      },
    };

    cy.intercept({
      method: 'GET',
      url: '/api/patients?filter*',
    }, {
      body: {
        data: [searchResult],
        included: [getResource(testPatient, 'patients')],
      },
      delay: 300,
    }).as('routePatientSearch');

    cy
      .routesForPatientDashboard()
      .routeSettings('manual_patient_creation', false)
      .routeActions()
      .visit()
      .wait('@routeActions');

    cy
      .get('.app-frame__nav')
      .find('.js-search')
      .as('search')
      .click();

    cy
      .get('.patient-search__modal')
      .find('.patient-search__input')
      .type('65132')
      .wait('@routePatientSearch');

    cy
      .get('.patient-search__modal')
      .find('.js-picklist-item strong')
      .should('contain', '65132')
      .parents('.js-picklist-item')
      .should('contain', 'Phone Number');

    cy.intercept({
      method: 'GET',
      url: '/api/patients?filter*',
    }, {
      body: {
        data: [{
          ...searchResult,
          attributes: { ...searchResult.attributes, match: { label: 'Name', value: `${ first_name } ${ last_name }` } },
        }],
        included: [getResource(testPatient, 'patients')],
      },
      delay: 300,
    }).as('routePatientSearch');

    // list view should re-render when users copy/paste/replace a search input
    cy
      .get('.patient-search__modal')
      .find('.patient-search__input')
      .invoke('val', `${ first_name }`)
      .trigger('input')
      .wait('@routePatientSearch');

    cy
      .get('.patient-search__modal')
      .find('.js-picklist-item')
      .first()
      .find('.patient-search__picklist-item-result-value')
      .should($el => {
        expect($el.text().trim()).to.be.empty;
      });

    cy
      .get('.patient-search__modal')
      .find('.js-picklist-item')
      .first()
      .find('.patient-search__picklist-item-result-label')
      .should($el => {
        expect($el.text().trim()).to.be.empty;
      });
  });

  specify('No Results with Patient Add', function() {
    cy.intercept({
      method: 'GET',
      url: '/api/patients?filter*',
    }, {
      body: { data: [] },
    }).as('routeEmptyPatientSearch');

    cy
      .routeSettings('manual_patient_creation', true)
      .routesForPatientDashboard()
      .routeActions()
      .visit()
      .wait('@routeActions');

    cy
      .get('.app-frame__nav')
      .find('.js-search')
      .as('search')
      .click();

    cy
      .get('.patient-search__modal')
      .as('searchModal')
      .find('.patient-search__input')
      .type('None')
      .wait('@routeEmptyPatientSearch');

    cy
      .get('@searchModal')
      .should('contain', 'No results match your query.')
      .contains('Add Patient')
      .click();

    cy
      .get('.modal')
      .should('contain', 'Add Patient');
  });
});
