import { extend, isString } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View, Region } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/modals.scss';

import intl from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import IframeFormBehavior from 'js/behaviors/iframe-form';
import ModalTemplate from './modal.hbs';

const i18n = intl.globals.modal.modalViews;

const ReplaceElRegion = Region.extend({ replaceElement: true, timeout: 0 });

const ModalView = View.extend({
  className: 'modal',
  buttonClass: 'button button--positive',
  bodyClass: 'modal__content',
  headerClass: 'modal__header',
  headerIconType: 'far',
  cancelText: i18n.modalView.cancelText,
  submitText: i18n.modalView.submitText,
  regionClass: ReplaceElRegion,
  regions: {
    header: '[data-header-region]',
    draftStatus: '[data-draft-status-region]',
    body: {
      el: '[data-body-region]',
      regionClass: PreloadRegion.extend({ timeout: 0 }),
    },
    footer: {
      el: '[data-footer-region]',
      replaceElement: false,
    },
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
    ['header', 'body', 'footer'].forEach(region => {
      const content = this[`${ region }View`];
      if (!content) return;

      const view = isString(content) ? new View({ template: () => content }) : content;
      this.showChildView(region, view);
    });
  },
  onSubmit() {
    this.destroy();
  },
  onCancel() {
    this.destroy();
  },
  disableSubmit(disable = true) {
    this.ui.submit[0].disabled = disable;
  },
  startPreloader() {
    this.getRegion('body').startPreloader({ variant: 'generic' });
  },
});

const SmallModalView = ModalView.extend({
  className: 'modal modal--small',
  bodyClass: 'modal__content modal__content--small',
  headerClass: 'modal__header modal__header--small',
});

const IframeFormView = View.extend({
  behaviors: [IframeFormBehavior],
  className: 'modal__form-iframe',
  template: hbs`<iframe src="{{ url }}"></iframe>`,
  templateContext() {
    return {
      url: this.model.getFormUrl({ modal: 1 }),
    };
  },
});

export {
  ModalView,
  SmallModalView,
  IframeFormView,
};
