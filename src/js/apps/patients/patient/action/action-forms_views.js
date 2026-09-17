import { View } from 'marionette';

import FormLayoutTemplate from './form-layout.hbs';

import './action.scss';

const FormLayoutView = View.extend({
  className: 'patient-action__form',
  template: FormLayoutTemplate,
  regions: {
    form: '[data-form-region]',
  },
});

export {
  FormLayoutView,
};
