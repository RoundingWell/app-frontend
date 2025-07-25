import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import IframeFormBehavior from 'js/behaviors/iframe-form';

import 'scss/modules/buttons.scss';
import './form.scss';

const iFrameFormView = View.extend({
  behaviors: [IframeFormBehavior],
  regions: {
    formAction: '[data-action-region]',
  },
  template: hbs`
  <div class="form__header">
    <div class="form__title">{{ name }}</div>
    <div data-action-region></div>
  </div>
  <div class="form__content">
    <iframe src="{{ url }}"></iframe>
  </div>
  `,
  templateContext() {
    return {
      url: this.model.getFormUrl(),
    };
  },
});

const SaveView = View.extend({
  isDisabled: false,
  tagName: 'button',
  className: 'button--green',
  attributes() {
    return {
      disabled: this.getOption('isDisabled'),
    };
  },
  template: hbs`Submit`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    this.$el.prop('disabled', true);
  },
});

export {
  iFrameFormView,
  SaveView,
};
