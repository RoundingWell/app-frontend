import Radio from 'backbone.radio';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import ErrorTemplate from './error.hbs';

import './error.scss';

const ErrorView = View.extend({
  className: 'error-page',
  template: ErrorTemplate,
  triggers: {
    'click .js-back': 'click:back',
  },
  onClickBack() {
    Radio.trigger('event-router', 'default');
  },
  templateContext() {
    return this.options;
  },
});

export {
  ErrorView,
};
