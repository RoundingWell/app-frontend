import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/loader.scss';
import 'scss/modules/sidebar.scss';
import 'scss/modules/skeleton.scss';

import intl from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';
import Optionlist from 'js/components/optionlist';

import LayoutTemplate from './layout.hbs';
import LoadingTemplate from './loading.hbs';

import './action.scss';

const i18n = intl.patients.patient.action.actionViews;

const ActionLoadingView = View.extend({
  className: 'loader patient__content patient-detail-page patient-action patient-action__loader',
  attributes: {
    'aria-busy': 'true',
    'role': 'status',
  },
  template: LoadingTemplate,
});

const MenuView = View.extend({
  tagName: 'button',
  className: 'button button--icon button--menu patient-detail-page__menu patient-action__menu js-menu',
  attributes: {
    'aria-label': i18n.menuView.menuOptions.headingText,
    'title': i18n.menuView.menuOptions.headingText,
    'type': 'button',
  },
  template: hbs`{{far "ellipsis"}}`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    const optionlist = new Optionlist({
      ui: this.$el,
      uiView: this,
      headingText: i18n.menuView.menuOptions.headingText,
      itemTemplate: hbs`{{far "trash-can" classes="sidebar__delete-icon"}}<span>{{ @intl.patients.patient.action.actionViews.menuView.menuOptions.delete }}</span>`,
      lists: [{ collection: new Backbone.Collection([{}]) }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', () => {
      this.triggerMethod('delete');
    });

    optionlist.show();
  },
});

const LayoutView = View.extend({
  className: 'patient__content patient__content--scroll patient-detail-page patient-action flex-region',
  attributes: {
    'data-form-viewport-scroll-container': '',
  },
  template: LayoutTemplate,
  regions: {
    menu: {
      el: '[data-menu-region]',
      replaceElement: true,
    },
    action: '[data-action-region]',
    form: {
      el: '[data-form-region]',
      replaceElement: true,
    },
    activity: {
      el: '[data-activity-region]',
      regionClass: PreloadRegion,
    },
    attachments: {
      el: '[data-attachments-region]',
      regionClass: PreloadRegion,
    },
  },
  getViewportElement() {
    return this.el;
  },
  getViewportMetrics() {
    const bounds = this.el.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const visibleTop = visualViewport ? Math.max(bounds.top, visualViewport.offsetTop) : bounds.top;
    const visibleBottom = visualViewport ?
      Math.min(bounds.bottom, visualViewport.offsetTop + visualViewport.height) :
      bounds.bottom;

    return {
      height: Math.max(0, visibleBottom - visibleTop),
      scrollTop: this.el.scrollTop,
      top: visibleTop,
    };
  },
  scrollViewportTo(options) {
    this.el.scrollTo(options);
  },
});

export {
  ActionLoadingView,
  LayoutView,
  MenuView,
};
