import {
  getDraft,
  setDraft,
  clearDrafts,
} from 'js/services/form-drafts';

Cypress.Commands.add('setFormDraft', (key, draft) => {
  return cy.then(() => setDraft(key, draft));
});

Cypress.Commands.add('getFormDraft', key => {
  return cy.then(() => getDraft(key));
});

function waitForFormDraft(key, { exists, attempts = 20 } = {}) {
  return getDraft(key).then(draft => {
    if (exists === undefined || Boolean(draft) === exists || attempts <= 0) return draft;
    return Cypress.Promise.delay(25).then(() => waitForFormDraft(key, { exists, attempts: attempts - 1 }));
  });
}

Cypress.Commands.add('waitForFormDraft', (key, options) => {
  return cy.then(() => waitForFormDraft(key, options));
});

Cypress.Commands.add('clearFormDrafts', () => {
  return cy.then(() => clearDrafts());
});
