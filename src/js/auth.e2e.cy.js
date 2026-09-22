import idb from 'js/base/cache/idb';

context('Authenticated draft ownership', function() {
  specify('restoring a session keeps only the authenticated user’s drafts', function() {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sid: 'session', iat: Date.now() / 1000, exp: Date.now() / 1000 + 3600 }));
    const accessToken = `${ header }.${ payload }.signature`;

    cy.clearFormDrafts();
    cy.setFormDraft('form-subm-user_A-patient-form', { updated: 'current' });
    cy.setFormDraft('form-subm-user_AB-patient-form', { updated: 'other' });
    cy.then(() => idb.put('formDrafts', 42, { updated: 'unrecognized' }));

    cy.intercept('GET', '/appconfig.json*', {
      body: {
        app: { stage: 'dev', name: 'Cypress Clinic', version: 'dev' },
        auth: {
          provider: 'workos',
          config: {
            clientId: 'client_test',
            createClientOptions: { apiHostname: 'localhost', port: 8090, https: false },
          },
        },
      },
    });
    cy.intercept('POST', '/user_management/authenticate', {
      body: {
        access_token: accessToken,
        refresh_token: 'test-refresh-token',
        user: { id: 'user_A', email: 'test@example.com', email_verified: true },
      },
    }).as('restoreSession');
    cy.routesForDefault().visit('/worklist/owned-by', {
      onBeforeLoad(win) {
        win.localStorage.setItem('workos:refresh-token:client_test', 'test-refresh-token');
      },
    });
    cy.wait('@restoreSession').its('request.body.grant_type').should('equal', 'refresh_token');
    cy.get('.worklist-list__item').should('be.visible');
    cy.getFormDraft('form-subm-user_A-patient-form').should('deep.equal', { updated: 'current' });
    cy.getFormDraft('form-subm-user_AB-patient-form').should('be.null');
    cy.then(() => idb.get('formDrafts', 42)).should('deep.equal', { updated: 'unrecognized' });
    cy.clearFormDrafts();
  });
});
