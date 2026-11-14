import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import service from 'js/entities-service/messaging-prototype';
import { NAMESPACE, PATIENT_IDS, WORKSPACE_ID } from 'js/entities-service/messaging-prototype/contract';
import { SummaryView } from './summary_view';

context('action-owned latest text preview', function() {
  specify('shares one pending patient read across two summaries and their websocket refresh', function() {
    const scope = testScope();
    const patientId = PATIENT_IDS[0];
    scope.reply(Radio, 'workspace', 'current', () => new Backbone.Model({ id: WORKSPACE_ID }));
    scope.reply(Radio, 'bootstrap', 'currentUser', () => ({ id: 'summary-reader', clientKey: 'summary-client' }));
    scope.reply(Radio, 'auth', 'getToken', () => 'synthetic-summary-token');
    cy.stub(service, 'getTarget').callsFake(() => ({ patientId, hostname: 'messaging-demo.invalid', stage: 'dev', organization: 'demo', workspaceId: WORKSPACE_ID }));
    const actions = ['first', 'second'].map(id => {
      const action = new Backbone.Model({ id, options: { embed: 'compose' }, _patient: { id: patientId }, _state: { id: 'state' } });
      action.getPatient = () => new Backbone.Model({ id: patientId });
      action.getState = () => new Backbone.Model({ id: 'state', status: 'started' });
      return action;
    });
    const value = { synthetic: true, contract_version: 1, namespace: NAMESPACE, patient_id: patientId, messaging_enabled: true, recipients: [],
      actions: { first: { state_id: 'state', composer: { enabled: false }, message_count: 7 }, second: { state_id: 'state', composer: { enabled: false }, message_count: 9 } },
    };
    let reads = 0;
    cy.intercept('GET', `/api/patients/${ patientId }/fields/prototype_messaging`, req => {
      reads++;
      req.reply({ body: { data: { id: 'field', type: 'patient-fields', attributes: { value } } } });
    });
    cy.mount(() => new (View.extend({
      template: hbs`<span data-first></span><span data-second></span>`,
      regions: { first: '[data-first]', second: '[data-second]' },
      onRender() {
        this.showChildView('first', new SummaryView({ action: actions[0] }));
        this.showChildView('second', new SummaryView({ action: actions[1] }));
      },
    }))());
    cy.get('[data-first] .messaging-summary__count').should('contain', '7');
    cy.get('[data-second] .messaging-summary__count').should('contain', '9');
    cy.then(() => {
      expect(reads).to.equal(1);
      value.actions.first.message_count = 8;
      value.actions.second.message_count = 10;
      Radio.trigger('ws', 'message:interactions', { payload: { patient: { id: patientId } } });
    });
    cy.get('[data-first] .messaging-summary__count').should('contain', '8');
    cy.get('[data-second] .messaging-summary__count').should('contain', '10');
    cy.then(() => expect(reads).to.equal(2));
  });
});
