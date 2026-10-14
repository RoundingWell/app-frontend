import _ from 'underscore';
import dayjs from 'dayjs';

// ***********************************************
// This example commands.js shows you how to
// create the custom command: 'login'.
//
// The commands.js file is a great place to
// modify existing commands and create custom
// commands for use throughout your tests.
//
// You can read more about custom commands here:
// https://on.cypress.io/api/commands
// ***********************************************
//

Cypress.Commands.add('getRadio', cb => {
  cy
    .window()
    .should('have.property', 'Radio')
    .then(Radio => {
      cb(Radio);
    });
});

// ***********************************************
//  routesFor*
//  Default routes needed when routing to common complex routes
//  Shouldn't be used to test particulars
// Should likely be near the top of route commands
// ***********************************************

Cypress.Commands.add('routesForDefault', () => {
  cy
    .routeActions();
});

Cypress.Commands.add('routesForPatientWorkflow', () => {
  cy
    .routePatient()
    .routePatientActions()
    .routePatientFlows()
    .routePatientInteractions()
    .routeWidgetValues()
    .routeWorkspacePatient()
    .routePrograms()
    .routeAllProgramActions()
    .routeAllProgramFlows();
});

Cypress.Commands.add('routesForPatientAction', () => {
  cy
    .routesForPatientWorkflow()
    .routeAction()
    .routeActionActivity()
    .routePatientByAction()
    .routeActionComments()
    .routeActionFiles();
});

Cypress.Commands.overwrite('visit', (originalFn, url = '/', options = {}) => {
  if (_.isObject(url)) {
    options = url;
    url = '/';
  }

  let waits = [
    '@routeWorkspaceClinicians',
    '@routeWorkspacePrograms',
    '@routeStates',
    '@routeForms',
  ];

  if (options.noWait) {
    waits = 0;
  }

  if (!options.isRoot) {
    url = `/one${ url }`;
  }

  cy.mockWs('ws://cypress-websocket/ws');

  // The router intercepts same-origin navigations, so a loaded app would handle
  // the visit in place. Blank the document first to force a real load. This
  // must follow mockWs: reversed, the websocket mock misses the new page.
  cy
    .window({ log: false })
    .then(win => {
      if (win.location.href !== 'about:blank') win.location.href = 'about:blank';
    })
    .location({ log: false })
    .should('have.property', 'href', 'about:blank');

  // pageLoadTimeout for visit is 60000ms. originalFn visits immediately, so it
  // runs from a command to stay behind the blanking.
  return cy
    .then({ timeout: 60000 }, () => originalFn(url, options))
    .wait(waits);
});

Cypress.Commands.add('visitOnClock', (url, options = {}) => {
  if (_.isObject(url)) {
    options = url;
    url = '/';
  }

  cy.clock(dayjs(options.now || dayjs()).valueOf(), options.functionNames);

  return cy.visit(url, options);
});

Cypress.Commands.add('navigate', (url, workspace = 'one') => {
  cy
    .window()
    .its('navigation')
    .invoke('navigate', `/${ workspace }${ url }`);
});

Cypress.Commands.add('iframe', (getSelector = 'iframe') => {
  cy
    .get(getSelector)
    .its('0.contentDocument.body')
    .should('not.be.empty')
    .then(body => cy.wrap(Cypress.$(body)));
});

Cypress.Commands.add('iframeStub', (getSelector = 'iframe') => {
  return cy
    .get(getSelector)
    .its('0.contentWindow.iframeStub')
    .should('exist');
});

Cypress.Commands.add('typeEnter', { prevSubject: true }, $el => {
  if (!$el) return;

  cy
    .wrap($el)
    .blur()
    // Need force because Cypress does not recognize the element is typeable
    .type('{enter}', { force: true });
});

// Exposes the hostname and decoded pathname and search query of an alias
Cypress.Commands.add('itsUrl', { prevSubject: true }, alias => {
  cy
    .wrap(alias)
    .its('request.url')
    .then(url => {
      const { hostname, pathname, search } = new URL(url);

      return { hostname, pathname: decodeURI(pathname), search: decodeURIComponent(search) };
    });
});

Cypress.Commands.add('hasBeforeContent', { prevSubject: true }, ($el, content) => {
  cy.window().then(win => {
    const before = win.getComputedStyle($el[0], '::before');
    const beforeContent = before.getPropertyValue('content');

    expect(beforeContent).to.equal(`"${ content }"`);
  });
});
