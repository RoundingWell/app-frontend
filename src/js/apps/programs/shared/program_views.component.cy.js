import Store from 'backbone.store';

import { Model as Form } from 'js/entities-service/entities/forms';
import { Collection, Model as ProgramAction } from 'js/entities-service/entities/program-actions';

import { ActionListView } from 'js/apps/programs/shared/program_views';

context('Program action list', function() {
  afterEach(function() {
    Store.resetAll();
  });

  specify('shows a form name when the cached form receives its name', function() {
    const form = new Form({ id: 'form-1' });
    const action = new ProgramAction({
      id: 'action-1',
      name: 'Intake',
      behavior: 'standard',
      days_until_due: null,
      _form: { id: 'form-1', type: 'forms' },
    });

    cy
      .mount(() => new ActionListView({ collection: new Collection([action]) }))
      .find('.program-items__form')
      .should('not.exist');

    cy.then(() => {
      form.set({ name: 'Test Form' });
    });

    cy
      .get('.program-items__form')
      .should('contain', 'Test Form');
  });
});
