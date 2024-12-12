import { extend } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View, Region } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/modals.scss';

import intl from 'js/i18n';

import { animSidebar } from 'js/anim';

import PreloadRegion from 'js/regions/preload_region';

import IframeFormBehavior from 'js/behaviors/iframe-form';

import ModalTemplate from './modal.hbs';

const i18n = intl.globals.modal.modalViews;

const ReplaceElRegion = Region.extend({ replaceElement: true, timeout: 0 });

const ModalView = View.extend({
  className: 'modal',
  buttonClass: 'button--green',
  bodyClass: 'modal__content',
  headerIconType: 'far',
  cancelText: i18n.modalView.cancelText,
  submitText: i18n.modalView.submitText,
  regionClass: ReplaceElRegion,
  regions: {
    header: '[data-header-region]',
    body: {
      el: '[data-body-region]',
      regionClass: PreloadRegion.extend({ timeout: 0 }),
    },
    footer: '[data-footer-region]',
    info: '[data-info-region]',
  },
  childViewTriggers: {
    'cancel': 'cancel',
    'submit': 'submit',
  },
  triggers: {
    'click @ui.close': 'cancel',
    'click @ui.submit': 'submit',
  },
  ui: {
    close: '.js-close',
    submit: '.js-submit',
  },
  serializeData() {
    // Passes data on the view to the template
    return extend({}, this);
  },
  template: ModalTemplate,
  initialize() {
    if (this.headerView) this.showChildView('header', this.headerView);
    if (this.bodyView) this.showChildView('body', this.bodyView);
    if (this.footerView) this.showChildView('footer', this.footerView);
  },
  onSubmit() {
    this.destroy();
  },
  onCancel() {
    this.destroy();
  },
  disableSubmit(disable = true) {
    this.ui.submit.prop('disabled', disable);
  },
  startPreloader() {
    this.getRegion('body').startPreloader();
  },
});

const SidebarModalView = ModalView.extend({
  className: 'modal--sidebar',
  bodyClass: 'modal__content--sidebar',
  headerClass: 'modal__header--sidebar',
  onAttach() {
    animSidebar(this.el);
  },
});

const SmallModalView = ModalView.extend({
  className: 'modal--small',
  bodyClass: 'modal__content--small',
  headerClass: 'modal__header--small',
});

const IframeFormView = View.extend({
  behaviors: [IframeFormBehavior],
  className() {
    const size = this.getOption('size');

    if (size === 'small') return 'modal__form-iframe--small';
    if (size === 'large') return 'modal__form-iframe--large';

    return 'modal__form-iframe';
  },
  template: hbs`<iframe src="/formapp/"></iframe>`,
});

export {
  ModalView,
  SidebarModalView,
  SmallModalView,
  IframeFormView,
};
