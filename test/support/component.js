import {
  setupHooks,
  getContainerEl,
} from '@cypress/mount-utils';

import '@cypress/code-coverage/support';
import './websockets';

import 'js/base/setup';
import $ from 'jquery';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import { Application } from 'js/app';

import { RootView } from 'js/apps/globals/app-frame/root_views';

Cypress.on('run:start', () => {
  // Consider doing a check to ensure your adapter only runs in Component Testing mode.
  if (Cypress.testingType !== 'component') {
    return;
  }

  Cypress.on('test:before:run', () => {
    // Do some cleanup from previous test - for example, clear the DOM.
    $(document).off();
    getContainerEl().innerHTML = '';
  });
});

const AppView = View.extend({
  regions: {
    region: '[data-region]',
  },
  template: hbs`<div data-region></div>`,
  contains: () => true,
});

function mount(getView = () => new View({ template: false })) {
  const app = new Application();
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

  return cy.get('[data-cy-root]');
}

Cypress.Commands.add('mount', mount);

// Setup Cypress lifecycle hooks.
setupHooks();
