import '@roundingwell/icons/styles.css';

import { mountApplication, setupCypress } from '@mnjs/test/cypress';

import '@cypress/code-coverage/support';
import './api-guard';
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

const AppView = View.extend({
  regions: {
    region: '[data-region]',
  },
  template: hbs`<div data-region></div>`,
  contains: () => true,
});

function mount(getView = () => new View({ template: false })) {
  return mountApplication(region => new TestApplication({ region }), { start: false }).then(({ app }) => {
    const TestRootView = RootView.extend({ AppView });
    const rootView = new TestRootView();

    app.setView(rootView);
    app.showView();

    const view = getView(rootView);

    rootView.appView.showChildView('region', view);
  }).get('#root');
}

setupCypress();
Cypress.Commands.add('mount', mount);
