import Store from 'backbone.store';

import { _Model as Action } from 'js/entities-service/entities/actions';
import { _Model as Artifact } from 'js/entities-service/entities/artifacts';
import { _Model as WritableClinician, Model as Clinician } from 'js/entities-service/entities/clinicians';
import { _Model as Comment } from 'js/entities-service/entities/comments';
import { _Model as File } from 'js/entities-service/entities/files';
import { _Model as Flow } from 'js/entities-service/entities/flows';
import { _Model as WritableFormResponse, Model as FormResponse } from 'js/entities-service/entities/form-responses';
import { _Model as WritablePatientField, Model as PatientField } from 'js/entities-service/entities/patient-fields';
import { _Model as Patient } from 'js/entities-service/entities/patients';
import { _Model as ProgramAction } from 'js/entities-service/entities/program-actions';
import { _Model as ProgramFlow } from 'js/entities-service/entities/program-flows';
import { _Model as Program } from 'js/entities-service/entities/programs';
import { _Model as WorkspacePatient } from 'js/entities-service/entities/workspace-patients';

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
        attributes: { value: 'high' },
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

  specify('includes only declared writable attributes for saved entity models', function() {
    const resources = [
      { Model: Action, writable: { name: 'Test Action' }, readOnly: { created_at: '2026-08-27T00:00:00Z' } },
      { Model: Artifact, writable: { artifact: 'test', identifier: 'test-id', values: {} } },
      { Model: WritableClinician, writable: { name: 'Test Clinician' }, readOnly: { disabled_at: null } },
      { Model: Comment, writable: { message: 'Test comment' }, readOnly: { edited_at: '2026-08-27T00:00:00Z' } },
      { Model: File, writable: { path: 'test/file.pdf' }, readOnly: { alias: 'file.pdf' } },
      { Model: Flow, writable: { name: 'Test Flow' }, readOnly: { updated_at: '2026-08-27T00:00:00Z' } },
      { Model: WritableFormResponse, writable: { status: 'draft' }, readOnly: { created_at: '2026-08-27T00:00:00Z' } },
      { Model: WritablePatientField, writable: { value: 'high' }, readOnly: { name: 'priority' } },
      { Model: Patient, writable: { first_name: 'Test' }, readOnly: { identifiers: [] } },
      { Model: ProgramAction, writable: { published_at: null }, readOnly: { created_at: '2026-08-27T00:00:00Z' } },
      { Model: ProgramFlow, writable: { archived_at: null }, readOnly: { updated_at: '2026-08-27T00:00:00Z' } },
      { Model: Program, writable: { published_at: null }, readOnly: { created_at: '2026-08-27T00:00:00Z' } },
      { Model: WorkspacePatient, writable: { status: 'active' }, readOnly: { segment: 'Test Segment' } },
    ];

    resources.forEach(({ Model, writable, readOnly = {} }) => {
      const model = new Model({
        id: 'resource-id',
        ...writable,
        ...readOnly,
        undeclared_attribute: true,
      });

      expect(model.toJSONApi().attributes).to.deep.equal(writable);
    });
  });
});
