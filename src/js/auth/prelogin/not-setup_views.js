import { View } from 'marionette';

import 'scss/modules/ambient-glow.scss';

import 'js/apps/globals/error/error.scss';

import NotSetupTemplate from './not-setup.hbs';

export default View.extend({
  className: 'error-page ambient-glow account-setup',
  template: NotSetupTemplate,
});
