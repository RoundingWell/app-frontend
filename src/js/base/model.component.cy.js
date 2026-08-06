import Store from 'backbone.store';

import { Model as Clinician } from 'js/entities-service/entities/clinicians';
import { Model as FormResponse } from 'js/entities-service/entities/form-responses';
import { Model as PatientField } from 'js/entities-service/entities/patient-fields';

context('Base model JSON:API serialization', function() {
  afterEach(function() {
    Store.resetAll();
  });

  specify('excludes Store resource identity from attributes', function() {
    const resources = [
      {
        Model: FormResponse,
        id: 'form-response-id',
        type: 'form-responses',
        attributes: { status: 'draft', response: {} },
      },
      {
        Model: PatientField,
        id: 'patient-field-id',
        type: 'patient-fields',
        attributes: { name: 'priority', value: 'high' },
      },
      {
        Model: Clinician,
        id: 'clinician-id',
        type: 'clinicians',
        attributes: { name: 'Test Clinician', email: 'test.clinician@roundingwell.com' },
      },
    ];

    resources.forEach(({ Model, id, type, attributes }) => {
      const model = new Model({ id, ...attributes });

      // Relationship resources update the shared Store model with both id and type.
      const relationshipModel = new Model({ id, type });

      expect(relationshipModel).to.equal(model);
      expect(model.toJSONApi()).to.deep.equal({ id, type, attributes });
    });
  });
});
