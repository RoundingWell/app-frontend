import {
  setupHooks,
  getContainerEl,
} from '@cypress/mount-utils';

import '@cypress/code-coverage/support';
import './websockets';

import 'scss/provider-core.scss';
import 'scss/app-root.scss';

import 'js/base/setup';
import 'js/i18n';
import 'js/entities-service';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import Application from 'js/base/app';
import listenToUserActivity from 'js/utils/user-activity';

import { RootView } from 'js/apps/globals/app-frame/root_views';

let app;

const TestApplication = Application.extend({
  channelName: 'app',
  radioRequests: {
    'show:pop': 'showPop',
  },
  initialize() {
    this._eventListeners = listenToUserActivity();
  },
  showPop(view, options) {
    return this.getView().getRegion('pop').show(view, options);
  },
  onDestroy() {
    this._eventListeners.abort();
  },
});

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

    app = new TestApplication({
      region: {
        el: getContainerEl(),
      },
    });

    const TestRootView = RootView.extend({ AppView });
    const rootView = new TestRootView();

    app.setView(rootView);
    app.showView();

    rootView.getRegion('preloader').empty();

    const view = getView(rootView);

    rootView.appView.showChildView('region', view);

    // Log a messsage in the Command Log.
    Cypress.log({
      name: 'mount',
      message: [`Mount View: ${ view.cid }`],
    });
  }).get('#root');
}

Cypress.Commands.add('mount', mount);

// Setup Cypress lifecycle hooks.
setupHooks();
