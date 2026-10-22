import { Radio, View } from 'marionette';

import 'scss/modules/ambient-glow.scss';
import 'scss/modules/buttons.scss';

import ErrorTemplate from './error.hbs';

import './error.scss';

const ErrorView = View.extend({
  className: 'error-page ambient-glow',
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
