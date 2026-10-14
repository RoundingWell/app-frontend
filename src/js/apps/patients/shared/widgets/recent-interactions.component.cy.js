import Backbone from 'backbone';

import { _Model as Interaction } from 'js/entities-service/entities/interactions';

import { RecentInteractionsView } from './recent-interactions_views';

context('recent interactions widget rendering', function() {
  specify('renders the newest window oldest-first without changing collection order', function() {
    const collection = new Backbone.Collection([
      new Interaction({ id: 'newest', channel: 'voice', occurred_at: '2026-09-24T10:00:00Z' }),
      new Interaction({ id: 'middle', channel: 'appointment', occurred_at: null, expected_at: '2026-09-24T09:59:00Z' }),
      new Interaction({ id: 'oldest', channel: 'sms', occurred_at: '2026-09-23T10:00:00Z' }),
    ]);
    const view = new RecentInteractionsView({ model: new Backbone.Model({ id: 'patient' }) });

    cy
      .mount(() => view)
      .then(() => {
        view.showInteractions(collection);
      });

    cy
      .get('.patient-interactions-preview__time')
      .should('have.length', 3)
      .and($times => {
        expect($times.toArray().map(time => time.getAttribute('datetime'))).to.deep.equal([
          '2026-09-23T10:00:00Z',
          '2026-09-24T09:59:00Z',
          '2026-09-24T10:00:00Z',
        ]);
        expect(collection.pluck('id')).to.deep.equal(['newest', 'middle', 'oldest']);
      });
  });

  specify('preserves API position for equal and missing timestamps', function() {
    const collection = new Backbone.Collection([
      new Interaction({ id: 'undated', channel: 'sms', metadata: { clinician_name: 'Undated' } }),
      new Interaction({ id: 'second', channel: 'sms', occurred_at: '2026-09-24T10:00:00Z', metadata: { clinician_name: 'Second' } }),
      new Interaction({ id: 'first', channel: 'sms', occurred_at: '2026-09-24T10:00:00Z', metadata: { clinician_name: 'First' } }),
    ]);
    const view = new RecentInteractionsView({ model: new Backbone.Model({ id: 'patient' }) });

    cy
      .mount(() => view)
      .then(() => {
        view.showInteractions(collection);
      });

    cy
      .get('.patient-interactions-preview__sender')
      .should($senders => {
        expect($senders.toArray().map(sender => sender.textContent)).to.deep.equal(['First', 'Second', 'Undated']);
        expect(collection.pluck('id')).to.deep.equal(['undated', 'second', 'first']);
      });
  });

  specify('renders an empty window and then one interaction', function() {
    const collection = new Backbone.Collection();
    const view = new RecentInteractionsView({ model: new Backbone.Model({ id: 'patient' }) });

    cy
      .mount(() => view)
      .then(() => {
        view.showInteractions(collection);
      });

    cy
      .get('.patient-interactions-preview')
      .should('contain', 'No interactions yet.');

    cy
      .then(() => {
        collection.add(new Interaction({ id: 'only', channel: 'sms', occurred_at: '2026-09-24T10:00:00Z' }));
      });

    cy
      .get('.patient-interactions-preview__time')
      .should('have.length', 1)
      .and('have.attr', 'datetime', '2026-09-24T10:00:00Z');
  });
});
