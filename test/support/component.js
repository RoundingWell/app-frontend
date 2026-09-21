import {
  setupHooks,
  getContainerEl,
} from '@cypress/mount-utils';

import '@cypress/code-coverage/support';
import './websockets';

import 'js/base/setup';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import { Application } from 'js/app';

import { RootView } from 'js/apps/globals/app-frame/root_views';

let app;

async function destroyApp() {
  const currentApp = app;
  app = undefined;

  await currentApp?.destroy();
}

Cypress.on('run:start', () => {
  // Consider doing a check to ensure your adapter only runs in Component Testing mode.
  if (Cypress.testingType !== 'component') {
    return;
  }

  Cypress.on('test:before:run:async', async() => {
    await destroyApp();
    getContainerEl().innerHTML = '';
  });
});

/* eslint-disable-next-line mocha/no-top-level-hooks */
afterEach(() => destroyApp());

const AppView = View.extend({
  regions: {
    region: '[data-region]',
  },
  template: hbs`<div data-region></div>`,
  contains: () => true,
});

function mount(getView = () => new View({ template: false })) {
  return cy.then(async() => {
    await destroyApp();

    app = new Application();
    app.setListeners();

    const TestRootView = RootView.extend({ AppView });

    const rootView = new TestRootView({ el: getContainerEl() });

    rootView.getRegion('preloader').empty();

    const view = getView(rootView);

    rootView.appView.showChildView('region', view);

    // Log a messsage in the Command Log.
    Cypress.log({
      name: 'mount',
      message: [`Mount View: ${ view.cid }`],
    });
  }).get('[data-cy-root]');
}

Cypress.Commands.add('mount', mount);

// Setup Cypress lifecycle hooks.
setupHooks();
