import { View } from 'marionette';

import PreloadRegion from 'js/regions/preload_region';

import 'scss/modules/fill-window.scss';

import PreloginTemplate from './prelogin.hbs';
import LoginPromptTemplate from './login-prompt.hbs';
import NotSetupTemplate from './not-setup.hbs';

import './prelogin.scss';

const LoginView = View.extend({
  triggers: {
    'click .js-login': 'click:login',
  },
  template: LoginPromptTemplate,
  templateContext: {
    url: location.host,
  },
});

const LoginPromptView = View.extend({
  el: '#root',
  /* istanbul ignore next: unable to test auth views in cypress */
  onRender() {
    this.showChildView('content', new LoginView());
  },
  regions: {
    content: {
      el: '[data-content-region]',
      regionClass: PreloadRegion,
    },
  },
  template: PreloginTemplate,
  childViewTriggers: {
    'click:login': 'click:login',
  },
});

const NotSetupView = View.extend({
  className: 'prelogin__message',
  template: NotSetupTemplate,
});

const PreloaderView = View.extend({
  className: 'fill-window',
  regions: {
    content: {
      el: '[data-content-region]',
      regionClass: PreloadRegion,
    },
  },
  template: PreloginTemplate,
  onRender() {
    if (this.getOption('notSetup')) {
      this.showChildView('content', new NotSetupView());
      return;
    }

    this.getRegion('content').startPreloader();
  },
});

export {
  PreloaderView,
  LoginPromptView,
};
