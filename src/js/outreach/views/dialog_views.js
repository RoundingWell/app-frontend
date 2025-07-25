import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import { appConfig } from '@roundingwell/care-ops-config';

import './dialog.scss';

const DialogView = View.extend({
  className: 'dialog__wrapper',
  template: hbs`
    <h1 class="site-title">{{ name }}</h1>
    <div class="dialog" data-content-region>
      <div class="dialog__icon dialog__icon--success">{{fat "circle-check"}}</div>
      <div>You’ve submitted the form. Nice job.</div>
    </div>
  `,
  templateContext() {
    return {
      name: appConfig.name,
    };
  },
  regions: {
    content: '[data-content-region]',
  },
});

export {
  DialogView,
};
