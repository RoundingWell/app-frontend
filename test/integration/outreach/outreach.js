import { getErrors, getRelationship } from 'helpers/json-api';

import { getFormFields } from 'support/api/form-fields';
import { getPatient } from 'support/api/patients';
import { getForm, testForm } from 'support/api/forms';

context('Outreach', function() {
  beforeEach(function() {
    cy.viewport('iphone-x');
  });

  specify('Opt-In success', function() {
    cy
      .visit('/outreach/opt-in', { noWait: true, isRoot: true });

    cy
      .intercept('POST', '/api/outreach', {
        delay: 100,
        statusCode: 204,
      })
      .as('routeOptInRequest');

    cy
      .get('.js-submit')
      .should('be.disabled');

    cy
      .get('.js-first-name')
      .type('Test');

    cy
      .get('.js-last-name')
      .type('Patient');

    cy
      .get('.js-dob-month')
      .select('5');

    cy
      .get('.js-dob-day')
      .select('5');

    cy
      .get('.js-dob-year')
      .select('1990');

    cy
      .get('.js-submit')
      .should('be.disabled');

    cy
      .get('.js-phone')
      .type('Not a valid phone number.');

    cy
      .get('.js-submit')
      .should('be.disabled');

    cy
      .get('.js-phone')
      .clear()
      .type('8887771234');

    cy
      .get('.js-submit')
      .should('not.be.disabled');

    cy
      .get('.js-first-name')
      .clear();

    cy
      .get('.js-submit')
      .should('be.disabled');

    cy
      .get('.js-first-name')
      .type('Test');

    cy
      .get('.js-submit')
      .should('not.be.disabled');

    cy
      .get('.js-dob-month')
      .select('Month');

    cy
      .get('.js-submit')
      .should('be.disabled');

    cy
      .get('.js-dob-month')
      .select('5');

    cy
      .get('.js-submit')
      .should('not.be.disabled');

    cy
      .get('.js-submit')
      .click()
      .should('be.disabled');

    cy
      .wait('@routeOptInRequest')
      .its('request.body')
      .should(({ data }) => {
        expect(data.type).to.equal('patients');
        expect(data.attributes.first_name).to.equal('Test');
        expect(data.attributes.last_name).to.equal('Patient');
        expect(data.attributes.birth_date).to.equal('1990-05-05');
        expect(data.attributes.phone).to.equal('+18887771234');
      });

    cy
      .get('.opt-in__heading-text')
      .should('contain', 'Your contact info is confirmed.');
  });

  specify('Opt-In error', function() {
    cy
      .visit('/outreach/opt-in', { noWait: true, isRoot: true });

    cy
      .intercept('POST', '/api/outreach', {
        delay: 100,
        statusCode: 400,
        body: { errors: getErrors() },
      })
      .as('routeOptInRequest')
      .visit('/outreach/opt-in', { noWait: true, isRoot: true });

    cy
      .get('.js-first-name')
      .type('Test');

    cy
      .get('.js-last-name')
      .type('Patient');

    cy
      .get('.js-dob-month')
      .select('10');

    cy
      .get('.js-dob-day')
      .select('10');

    cy
      .get('.js-dob-year')
      .select('1990');

    cy
      .get('.js-phone')
      .type('+18887771234');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeOptInRequest');

    cy
      .get('.opt-in__heading-text')
      .should('contain', 'We were not able to confirm your contact info.');

    cy
      .get('.js-try-again')
      .click();

    cy
      .get('.opt-in__heading-text')
      .first()
      .should('contain', 'Hi, we need to confirm your contact info.');

    cy
      .get('.js-submit')
      .should('not.be.disabled');
  });

  specify('User verification success', function() {
    const testPatient = getPatient;
    cy
      .routeOutreachStatus(fx => {
        fx.data.relationships.patient = getRelationship(testPatient);

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormActionDefinition()
      .routeFormActionFields()
      .visit('/outreach/11111', { noWait: true, isRoot: true })
      .wait('@routeOutreachStatus');

    cy
      .intercept('POST', '/api/outreach/otp', {
        delay: 100,
        statusCode: 204,
      })
      .as('routeCreateVerifyCodeRequest');

    cy
      .get('.verify__heading-text')
      .should('contain', 'Request a verification code to view this health resource.');

    cy
      .get('.verify__info-text')
      .should('contain', 'We’ll send a text message with a verification code to the phone number XXX-XXX-1234.');

    cy
      .get('.js-submit')
      .click()
      .should('be.disabled');

    cy
      .wait('@routeCreateVerifyCodeRequest')
      .its('request.body')
      .should(({ data }) => {
        expect(data.type).to.equal('patient-actions');
        expect(data.id).to.equal('11111');
      });

    cy
      .get('.verify__heading-text')
      .should('contain', 'Enter your verification code.');

    cy
      .get('.verify__info-text')
      .should('contain', 'We sent a text message with a verification code to the phone number XXX-XXX-1234.');

    cy
      .get('.js-resend')
      .click();

    cy
      .get('.verify__heading-text')
      .should('contain', 'Request a verification code to view this health resource.');

    cy
      .get('.verify__info-text')
      .should('contain', 'We’ll send a text message with a verification code to the phone number XXX-XXX-1234.');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeCreateVerifyCodeRequest');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .type('1234');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .should('have.value', '1')
      .next()
      .should('have.value', '2')
      .next()
      .should('have.value', '3')
      .next()
      .should('have.value', '4');

    cy
      .get('.js-submit')
      .should('not.be.disabled');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .last()
      .type('{backspace}{backspace}{backspace}{backspace}');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .should('have.value', '')
      .next()
      .should('have.value', '')
      .next()
      .should('have.value', '')
      .next()
      .should('have.value', '');

    cy
      .get('.js-submit')
      .should('be.disabled');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      // NOTE: ' 12 34' is used to ensure all empty spaces are automatically removed
      .invoke('val', ' 12 34')
      .trigger('input');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .should('have.value', '1')
      .next()
      .should('have.value', '2')
      .next()
      .should('have.value', '3')
      .next()
      .should('have.value', '4');

    cy
      .intercept('POST', '/api/outreach/auth', {
        delay: 100,
        body: {
          data: {
            id: '33333',
            type: 'patient-tokens',
            attributes: {
              token: 'token-success',
            },
          },
        },
      })
      .as('routeVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .should('be.disabled');

    cy
      .wait('@routeVerifyCodeRequest')
      .its('request.body')
      .should(({ data }) => {
        expect(data.type).to.equal('outreach');
        expect(data.id).to.equal('11111');
        expect(data.attributes.code).to.equal('1234');
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
      });

    cy
      .get('.form__title')
      .contains('Test Form');
  });

  specify('User verification - api error when creating new code', function() {
    cy
      .routeOutreachStatus()
      .visit('/outreach/11111', { noWait: true, isRoot: true })
      .wait('@routeOutreachStatus');

    cy
      .intercept('POST', '/api/outreach/otp', {
        statusCode: 400,
        body: { errors: getErrors() },
      })
      .as('routeCreateVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click();

    cy
      .wait('@routeCreateVerifyCodeRequest');

    cy
      .get('body')
      .contains('Uh-oh, there was an error. Try reloading the page.');
  });

  specify('User verification - user entered an invalid code', function() {
    cy
      .routeOutreachStatus()
      .visit('/outreach/11111', { noWait: true, isRoot: true })
      .wait('@routeOutreachStatus');

    cy
      .intercept('POST', '/api/outreach/otp', {
        statusCode: 204,
      })
      .as('routeCreateVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click();

    cy
      .wait('@routeCreateVerifyCodeRequest');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .type('5678');

    cy
      .intercept('POST', '/api/outreach/auth', {
        statusCode: 403,
        delay: 100,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Forbidden',
            detail: 'Insufficient permissions',
          }),
        },
      })
      .as('routeVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .should('be.disabled');

    cy
      .wait('@routeVerifyCodeRequest');

    cy
      .get('.verify__code-fields')
      .find('.js-input.has-error')
      .should('have.length', 4)
      .first()
      .should('have.value', '')
      .next()
      .should('have.value', '')
      .next()
      .should('have.value', '')
      .next()
      .should('have.value', '');

    cy
      .get('.verify__error-text')
      .should('exist');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .type('1');

    cy
      .get('.verify__code-fields')
      .find('.js-input.has-error')
      .should('exist');

    cy
      .get('.verify__error-text')
      .should('exist');
  });

  specify('User verification - no longer shared error', function() {
    cy
      .intercept('GET', '/api/outreach?filter[action]=11111', {
        statusCode: 404,
        body: {
          errors: getErrors({
            status: '404',
            title: 'Not Found',
          }),
        },
      })
      .as('routeOutreachStatusError')
      .visit('/outreach/11111', { noWait: true, isRoot: true })
      .wait('@routeOutreachStatusError');

    cy
      .get('body')
      .contains('This form is no longer shared. Nothing else to do here.');
  });

  specify('User verification - form already submitted', function() {
    cy
      .intercept('GET', '/api/outreach?filter[action]=11111', {
        statusCode: 409,
        body: {
          errors: getErrors({
            status: '409',
            title: 'Conflict',
          }),
        },
      })
      .as('routeOutreachStatusError')
      .visit('/outreach/11111', { noWait: true, isRoot: true })
      .wait('@routeOutreachStatusError');

    cy
      .get('body')
      .contains('This form has already been submitted.');
  });

  specify('Form', function() {
    cy
      .routeOutreachStatus()
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormActionDefinition()
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              weight: 200,
            },
            patient: {
              first_name: 'Joe',
              last_name: 'Johnson',
            },
          },
        });

        return fx;
      })
      .visit('/outreach/11111', { noWait: true, isRoot: true })
      .wait('@routeOutreachStatus');

    cy
      .intercept('POST', '/api/outreach/otp', {
        statusCode: 204,
      })
      .as('routeCreateVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click();

    cy
      .wait('@routeCreateVerifyCodeRequest');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .type('1234');

    cy
      .intercept('POST', '/api/outreach/auth', {
        delay: 100,
        body: {
          data: {
            type: 'patient-tokens',
            attributes: {
              token: 'token-success',
            },
          },
        },
      })
      .as('routeVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeVerifyCodeRequest')
      .wait('@routeFormByAction')
      .wait('@routeFormActionFields')
      .wait('@routeFormActionDefinition');

    cy
      .get('.form__title')
      .contains('Test Form');

    cy
      .intercept('POST', '/api/actions/11111/relationships/form-responses', {
        statusCode: 400,
        delay: 100,
        body: {
          errors: getErrors({
            detail: 'This is a form error',
          }),
        },
      })
      .as('postFormResponseError');

    cy
      .iframe()
      .as('iframe');

    cy
      .get('@iframe')
      .find('textarea[name="data[familyHistory]"]')
      .clear()
      .type('New typing');

    cy
      .get('@iframe')
      .find('textarea[name="data[storyTime]"]')
      .clear()
      .type('Once upon a time...');

    cy
      .get('[data-action-region]')
      .contains('Submit')
      .click()
      .wait('@postFormResponseError')
      .its('request.body')
      .should(({ data }) => {
        expect(data.type).to.equal('form-responses');
        expect(data.id).to.not.be.empty;
        expect(data.relationships.action.data.id).to.equal('11111');
        expect(data.relationships.form.data.id).to.equal(testForm.id);
        expect(data.attributes.response.data.familyHistory).to.equal('New typing');
        expect(data.attributes.response.data.storyTime).to.equal('Once upon a time...');
        expect(data.attributes.response.data.patient.first_name).to.equal('Joe');
        expect(data.attributes.response.data.patient.last_name).to.equal('Johnson');
        expect(data.attributes.response.data.fields.weight).to.equal(200);
      });

    cy
      .iframe()
      .find('.alert')
      .contains('This is a form error');

    cy
      .intercept('POST', '/api/actions/11111/relationships/form-responses', {
        delay: 100,
        body: { data: {} },
      })
      .as('postFormResponse');

    cy
      .get('[data-action-region]')
      .find('button')
      .click()
      .wait('@postFormResponse');

    cy
      .get('body')
      .contains('You’ve submitted the form. Nice job.');
  });

  specify('Read-only Form', function() {
    cy
      .routeOutreachStatus()
      .routeFormByAction(fx => {
        fx.data = getForm({
          attributes: {
            name: 'Read Only Test Form',
            options: {
              read_only: true,
            },
          },
        });

        return fx;
      })
      .routeFormActionDefinition()
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              foo: 'bar',
            },
          },
        });

        return fx;
      })
      .visit('/outreach/11111', { noWait: true, isRoot: true })
      .wait('@routeOutreachStatus');

    cy
      .intercept('POST', '/api/outreach/otp', {
        statusCode: 204,
      })
      .as('routeCreateVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeCreateVerifyCodeRequest');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .type('1234');

    cy
      .intercept('POST', '/api/outreach/auth', {
        delay: 100,
        body: {
          data: {
            type: 'patient-tokens',
            attributes: {
              token: 'success-token',
            },
          },
        },
      })
      .as('routeVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeVerifyCodeRequest')
      .wait('@routeFormByAction')
      .wait('@routeFormActionDefinition')
      .wait('@routeFormActionFields');

    cy
      .get('.form__title')
      .contains('Read Only Test Form');

    cy
      .get('[data-action-region]')
      .should('not.contain', 'Submit');

    cy
      .iframe()
      .as('iframe');

    cy
      .get('@iframe')
      .find('input[name="data[fields.foo]"]')
      .should('have.value', 'bar');
  });

  specify('500 error', function() {
    cy
      .intercept('GET', '/api/outreach?filter[action]=11111', req => {
        req.reply({
          statusCode: 500,
          body: {},
        });
      })
      .routeFormByAction()
      .routeFormActionDefinition()
      .routeFormActionFields()
      .visit('/outreach/11111', { noWait: true, isRoot: true });

    cy
      .url()
      .should('contain', 'outreach/unknown-error');

    cy
      .get('body')
      .contains('Uh-oh, there was an error.');

    cy
      .routeOutreachStatus();

    cy
      .get('body')
      .find('.js-try-again')
      .click()
      .wait('@routeOutreachStatus');

    cy
      .url()
      .should('contain', 'outreach/11111');

    cy
      .intercept('POST', '/api/outreach/otp', {
        statusCode: 500,
        body: {},
      })
      .as('routeCreateVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeCreateVerifyCodeRequest');

    cy
      .url()
      .should('contain', 'outreach/unknown-error');

    cy
      .get('body')
      .contains('Uh-oh, there was an error.');

    cy
      .get('body')
      .find('.js-try-again')
      .click();

    cy
      .intercept('POST', '/api/outreach/otp', {
        statusCode: 204,
      })
      .as('routeCreateVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeCreateVerifyCodeRequest');

    cy
      .get('.verify__code-fields')
      .find('.js-input')
      .first()
      .type('5678');

    cy
      .intercept('POST', '/api/outreach/auth', {
        statusCode: 500,
        body: {},
      })
      .as('routeVerifyCodeRequest');

    cy
      .get('.js-submit')
      .click()
      .wait('@routeVerifyCodeRequest');

    cy
      .url()
      .should('contain', 'outreach/unknown-error');

    cy
      .get('body')
      .contains('Uh-oh, there was an error.');
  });

  specify('404 error', function() {
    cy
      .visit('/outreach', { noWait: true, isRoot: true });

    cy
      .get('body')
      .contains('Oops! The page you requested can\’t be found.');

    cy
      .visit('/outreach/', { noWait: true, isRoot: true });

    cy
      .get('body')
      .contains('Oops! The page you requested can\’t be found.');

    cy
      .visit('/outreach/11111/22222', { noWait: true, isRoot: true });

    cy
      .get('body')
      .contains('Oops! The page you requested can\’t be found.');
  });
});
