import Backbone from 'backbone';

import ConsentAuditView from './consent-audit_view';

context('isolated consent audit presentation contract', function() {
  specify('escapes historical actor, source and number snapshots and shows patient-wide DNC', function() {
    const model = new Backbone.Model({
      segments: [
        { text: '<Demo Staff>', strong: true },
        { text: ' (Care Navigator) recorded that Demo opted out of texts' },
      ],
      scopeLabel: 'Phone number',
      number: '(615) 555-0144',
      source: '<img src=x onerror=alert(1)>',
      time: { datetime: '2026-11-12T10:00:00Z', label: 'Nov 12, 2026 · 10:00 AM' },
    });

    cy.mount(() => new ConsentAuditView({ model, presentAudit: interaction => interaction.toJSON() }));

    cy
      .get('.messaging-consent-audit')
      .should('contain', '<Demo Staff>')
      .and('contain', '(Care Navigator) recorded that Demo opted out of texts')
      .and('contain', '(615) 555-0144')
      .and('contain', '<img src=x onerror=alert(1)>')
      .find('img, script')
      .should('not.exist');

    cy
      .get('.messaging-consent-audit__time')
      .should('have.attr', 'datetime', '2026-11-12T10:00:00Z')
      .and('have.text', 'Nov 12, 2026 · 10:00 AM');

    // Removing the patient's phone elsewhere cannot erase an audit snapshot:
    // the presenter takes no current phone list.
    cy
      .then(() => {
        model.set({ source: 'Imported from Example Import', currentPhones: [] });
      });

    cy
      .get('.messaging-consent-audit')
      .should('contain', '(615) 555-0144')
      .and('contain', 'Imported from Example Import');

    cy
      .then(() => model.set({
        segments: [{ text: 'Demo Patient', strong: true }, { text: ' opted in to texts by texting START' }],
        source: 'Patient texted START',
      }));

    cy
      .get('.messaging-consent-audit')
      .should('contain', 'Demo Patient opted in to texts by texting START')
      .and('contain', '(615) 555-0144');

    cy
      .then(() => model.set({
        segments: [{ text: 'Demo Staff', strong: true }, { text: ' set Do Not Contact' }],
        scopeLabel: 'All patient numbers', number: null, source: 'Demographics form',
      }));

    cy
      .get('.messaging-consent-audit')
      .should('contain', 'set Do Not Contact')
      .and('contain', 'All patient numbers')
      .and('not.contain', '(615) 555-0144');

    cy.viewport(320, 640);

    cy
      .get('.messaging-consent-audit')
      .should($row => expect($row[0].scrollWidth).to.be.at.most($row[0].clientWidth));

    cy.screenshot('messaging-consent-audit-mobile', { capture: 'viewport' });
  });
});
