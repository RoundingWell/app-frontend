import Backbone from 'backbone';

import MessageCardView from './message-card_view';

const labels = { sms: 'SMS', showMore: 'Show more' };

function message(overrides) {
  return {
    senderName: 'Demo Staff',
    senderKind: 'team',
    kind: 'message',
    viaLabel: 'via SMS',
    status: 'sent',
    statusLabel: 'Sent',
    time: { datetime: '2026-11-12T09:48:00Z', label: '9:48 AM' },
    body: 'Hello Demo',
    ...overrides,
  };
}

function mountMessage(props, options) {
  const model = new Backbone.Model(props);
  const view = new MessageCardView({ model, presentInteraction: interaction => interaction.toJSON(), labels, ...options });
  cy.mount(() => view);
  return { model, view };
}

context('isolated message card presentation contract', function() {
  specify('shows supplied outcomes without treating sent as delivered and refreshes normally', function() {
    const { model } = mountMessage(message({ action: { id: 'other', name: 'Welcome home' } }), { currentActionId: 'current' });

    cy
      .get('.messaging-card__headline')
      .should('contain', 'Sent')
      .and('not.contain', 'Delivered');

    cy
      .get('.messaging-card__action')
      .should('contain', 'Welcome home');

    cy
      .then(() => {
        model.set({ status: 'delivered', statusLabel: '', action: { id: 'current', name: 'Current message' } });
      });

    cy
      .get('.messaging-card__headline')
      .should('contain', 'via SMS • 9:48 AM')
      .and('not.contain', 'Sent');

    cy
      .get('.messaging-card__action')
      .should('not.exist');

    cy
      .then(() => {
        model.set({ status: 'scheduled', statusLabel: 'Scheduled', time: { datetime: '2026-11-13T08:00:00Z', label: 'Nov 13, 8:00 AM' } });
      });

    cy
      .get('.messaging-card__bubble')
      .should('have.css', 'border-top-style', 'dashed');

    cy
      .get('.messaging-card__headline')
      .should('contain', 'Scheduled')
      .find('time')
      .should('have.attr', 'datetime', '2026-11-13T08:00:00Z');

    cy
      .then(() => {
        model.set({ status: 'cancelled', statusLabel: 'Cancelled', time: null });
      });

    cy
      .get('.messaging-card--muted')
      .should('be.visible')
      .and('contain', 'Cancelled');

    cy
      .then(() => {
        model.set({ status: 'failed', statusLabel: 'Not delivered', reason: 'This number can\'t receive texts.', destination: '(615) 555-0190' });
      });

    cy
      .get('.messaging-card--failed')
      .should('contain', 'Not delivered')
      .find('.messaging-card__reason')
      .should('contain', 'This number can\'t receive texts.')
      .and('contain', '(615) 555-0190')
      .then($reason => {
        cy.get('.messaging-card__status').should('have.css', 'color', $reason.css('color'));
      });

    cy
      .then(() => {
        model.set({ status: 'not-sent', statusLabel: 'Not sent:', reason: 'Do Not Contact', destination: null });
      });

    cy
      .get('.messaging-card')
      .should('contain', 'Not sent:')
      .and('contain', 'Do Not Contact');

    cy
      .contains('button', /Retry|Send now/)
      .should('not.exist');
  });

  specify('retains dispositions and headings, other-action navigation, and hides consent carrier messages', function() {
    const { model, view } = mountMessage(message({ body: '', disposition: '4th of July Text Blast', directionLabel: 'Outbound', action: { id: 'linked', name: 'Message Jul 4' } }));
    const navigate = cy.stub().as('navigate');
    view.on('navigate:action', navigate);

    cy
      .get('.messaging-card__bubble')
      .should('contain', 'Outbound SMS • 4th of July Text Blast');

    cy
      .get('.messaging-card__action')
      .click();

    cy
      .get('@navigate')
      .should('have.been.calledOnceWith', 'linked');

    cy
      .then(() => {
        model.set({ body: 'Thanks for your message', disposition: 'Text Sent', kind: 'auto-reply', viaLabel: 'via SMS auto-reply', action: null });
      });

    cy
      .get('.messaging-card--muted')
      .should('contain', 'via SMS auto-reply')
      .and('contain', 'Outbound SMS • Text Sent')
      .and('contain', 'Thanks for your message');

    cy
      .get('.messaging-card__action')
      .should('not.exist');

    cy
      .then(() => model.set({ kind: 'consent', body: 'STOP' }));

    cy
      .get('.messaging-card')
      .should('not.be.visible')
      .and('be.empty');

    cy
      .then(() => model.set({ kind: 'carrier-response', body: 'You have been unsubscribed' }));

    cy
      .get('.messaging-card')
      .should('not.be.visible')
      .and('be.empty');

    cy
      .then(() => model.set({ kind: 'message', senderKind: 'patient', senderName: 'Demo Patient', body: '', disposition: null }));

    cy
      .get('.messaging-card--patient')
      .should('not.be.visible')
      .and('be.empty');

    cy
      .get('.messaging-card__bubble')
      .should('not.exist');

    cy.then(() => model.set({ status: 'failed', reason: 'This number cannot receive texts.' }));
    cy.get('.messaging-card').should('be.visible').and('contain', 'This number cannot receive texts.');
    cy.get('.messaging-card__bubble').should('not.exist');
    cy.then(() => model.set({ body: null, reason: null }));
    cy.get('.messaging-card').should('not.be.visible').and('be.empty');
  });

  specify('escapes text, preserves line breaks and only links HTTP(S) URLs', function() {
    const body = '<img src=x onerror=alert(1)>\nVisit https://example.org/help?q=1&x=2. Also (https://example.org/Foo_(bar)). Then javascript:alert(1) and data:text/html,test';
    mountMessage(message({ body }));

    cy
      .get('.messaging-card__body')
      .should('have.text', body)
      .find('img, script')
      .should('not.exist');

    cy
      .get('.messaging-card__body')
      .find('a')
      .should('have.length', 2)
      .first()
      .and('have.attr', 'href', 'https://example.org/help?q=1&x=2')
      .and('have.attr', 'rel', 'noopener noreferrer');
    cy.get('.messaging-card__body a').last().should('have.attr', 'href', 'https://example.org/Foo_(bar)');
  });
});
