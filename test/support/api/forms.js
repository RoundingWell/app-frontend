import _ from 'underscore';
import { v4 as uuid } from 'uuid';
import { getResource, mergeJsonApi } from 'helpers/json-api';

import fxTestForms from 'fixtures/collections/forms';

const fxSampleForms = _.rest(fxTestForms, 1);

const TYPE = 'forms';

// Exporting only form needed for testing variance
export const testForm = getResource(_.extend(fxTestForms[0], {
  name: 'Test Form',
}), TYPE);

export function getForm(data) {
  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(testForm, data);
}

export function getForms() {
  return [testForm, ...getResource(fxSampleForms, TYPE)];
}

Cypress.Commands.add('routeForms', (mutator = _.identity) => {
  cy
    .intercept('GET', '/api/forms', {
      body: mutator({
        data: getForms(),
        included: [],
      }),
    })
    .as('routeForms');
});

Cypress.Commands.add('routeForm', (mutator = _.identity, id = '') => {
  const data = getForm();

  cy
    .intercept('GET', `/api/forms/${ id }*`, {
      body: mutator({ data, included: [] }),
    })
    .as(`routeForm${ id }`);
});

Cypress.Commands.add('routeFormByAction', (mutator = _.identity) => {
  const data = getForm();

  cy
    .intercept('GET', '/api/actions/*/form', {
      body: mutator({ data, included: [] }),
    })
    .as('routeFormByAction');
});
