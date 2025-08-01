import $ from 'jquery';
import 'js/base/setup';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { Region } from 'marionette';
import 'js/base/fontawesome';
import 'js/entities-service/forms';

import RouterApp from 'js/base/routerapp';

import VerifyApp from 'js/outreach/apps/verify_app';
import FormApp from 'js/outreach/apps/form_app';
import OptInApp from 'js/outreach/apps/opt-in_app';
import ErrorApp from 'js/outreach/apps/error_app';

import 'scss/outreach-core.scss';
import './outreach.scss';

const OutreachApp = RouterApp.extend({
  childApps: {
    verify: VerifyApp,
    form: FormApp,
    optIn: OptInApp,
  },
  routerAppName: 'OutreachApp',
  eventRoutes: {
    'outreach:id': {
      route: 'outreach/:id',
      action: 'show',
      root: true,
    },
    'outreach:opt:in': {
      route: 'outreach/opt-in',
      action: 'showOptIn',
      root: true,
    },
  },
  show(actionId) {
    this.actionId = actionId;

    this.startVerify();
  },
  startVerify() {
    const verifyApp = this.startCurrent('verify', { actionId: this.actionId });

    this.listenTo(verifyApp, 'stop', () => {
      const token = Radio.request('auth', 'getToken');

      /* istanbul ignore next: Should be impossible */
      if (!token) {
        Radio.trigger('event-router', 'unknownError');
        return;
      }

      this.startForm();
    });
  },
  startForm() {
    this.startCurrent('form', { actionId: this.actionId });
  },
  showOptIn() {
    this.startCurrent('optIn');
  },
});

function startOutreachApp() {
  // Modify viewport for mobile devices at full width
  $('meta[name=viewport]').attr('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
  const baseRegion = new Region({ el: document.getElementById('root') });
  new ErrorApp({ region: baseRegion });
  new OutreachApp({ region: baseRegion });
  Backbone.history.start({ pushState: true });
}

export {
  startOutreachApp,
};
