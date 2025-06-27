import _ from 'underscore';
import { v5 as uuid } from 'uuid';
import { RWELL_NS } from 'js/static';
import { getResource, mergeJsonApi } from 'helpers/json-api';
import { getPatient } from 'support/api/patients';

import fxPatientFields from 'fixtures/collections/patient-fields';

const TYPE = 'patient-fields';

export function getPatientFieldId(patientId, fieldName) {
  return uuid(`patient:${ patientId }:field:${ String(fieldName).toLowerCase() }`, RWELL_NS);
}

export function getPatientField(data) {
  const resource = getResource(_.sample(fxPatientFields), TYPE);

  const patientField = mergeJsonApi(resource, data);

  const patientId = _.get(patientField, 'relationships.patient.id') || getPatient({}, { depth: 1 }).id;

  patientField.id = getPatientFieldId(patientId, patientField.attributes.name);

  return patientField;
}

export function getPatientFields({ attributes, relationships, meta } = {}, { sample = 3, depth } = {}) {
  if (depth++ > 1) return;

  return _.times(sample, () => getPatientField({ attributes, relationships, meta }));
}

Cypress.Commands.add('routePatientField', (mutator = _.identity, fieldName) => {
  const data = getPatientField();
  const alias = fieldName ? `routePatientField${ fieldName }` : 'routePatientField';

  cy
    .intercept('GET', `/api/patients/**/fields/${ fieldName || '**' }`, {
      body: mutator({ data, included: [] }),
    })
    .as(alias);
});

Cypress.Commands.add('routePatientFieldHistory', (mutator = _.identity, fieldName) => {
  const data = getPatientField();
  const alias = fieldName ? `routePatientField${ fieldName }History` : 'routePatientFieldHistory';

  cy
    .intercept('GET', `/api/patients/**/fields/${ fieldName || '**' }/history**`, {
      body: mutator({ data, included: [] }),
    })
    .as(alias);
});
