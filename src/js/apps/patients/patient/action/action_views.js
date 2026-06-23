import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/sidebar.scss';

import intl from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import Optionlist from 'js/components/optionlist';

import './action.scss';

const HeadingView = View.extend({
  template: hbs`{{formatMessage (intlGet "patients.patient.action.actionViews.headingView.headingText") outreach=outreach}}`,
});

const FooterView = View.extend({
  className: 'flex-grow',
  template: hbs`
    <div class="u-margin--t-16" data-comment-region></div>
    <div data-timestamps-region></div>
  `,
  regions: {
    timestamps: '[data-timestamps-region]',
    comment: '[data-comment-region]',
  },
});

const MenuView = View.extend({
  tagName: 'button',
  className: 'button--icon js-menu',
  template: hbs`{{far "ellipsis"}}`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    const menuOptions = new Backbone.Collection([{}]);

    const optionlist = new Optionlist({
      ui: this.$el,
      uiView: this,
      headingText: intl.patients.patient.action.actionViews.menuView.menuOptions.headingText,
      itemTemplate: hbs`{{far "trash-can" classes="sidebar__delete-icon"}}<span>{{ @intl.patients.patient.action.actionViews.menuView.menuOptions.delete }}</span>`,
      lists: [{ collection: menuOptions }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', () => {
      this.triggerMethod('delete');
    });

    optionlist.show();
  },
});

const ContentView = View.extend({
  className: 'flex-grow',
  template: hbs`
    <div data-action-region></div>
    <div data-dialer-region></div>
    <div data-form-region></div>
    <div data-attachments-region></div>
    <div class="patient-action__activity" data-activity-region></div>
  `,
  regions: {
    action: '[data-action-region]',
    dialer: '[data-dialer-region]',
    form: {
      el: '[data-form-region]',
      replaceElement: true,
    },
    activity: {
      el: '[data-activity-region]',
      regionClass: PreloadRegion,
    },
    attachments: '[data-attachments-region]',
  },
});

export {
  ContentView,
  HeadingView,
  MenuView,
  FooterView,
};
