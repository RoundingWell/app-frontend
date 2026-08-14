import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/sidebar.scss';

import { ACTION_SHARING } from 'js/static';

import PreloadRegion from 'js/regions/preload_region';

import FormLayoutTemplate from './form-layout.hbs';
import FormSharingTemplate from './form-sharing.hbs';

import './action.scss';

function getSharingOpts(sharing) {
  switch (sharing) {
    case ACTION_SHARING.PENDING:
    case ACTION_SHARING.SENT:
      return {
        iconType: 'fas',
        icon: 'circle-dot',
        color: 'black',
      };
    case ACTION_SHARING.RESPONDED:
      return {
        iconType: 'fas',
        icon: 'circle-check',
        color: 'green',
      };
    case ACTION_SHARING.CANCELED:
    case ACTION_SHARING.ERROR_OPT_OUT:
      return {
        iconType: 'far',
        icon: 'octagon-minus',
        color: 'orange',
      };
    default:
      return {
        iconType: 'fas',
        icon: 'circle-exclamation',
        color: 'red',
      };
  }
}

const FormSharingView = View.extend({
  className: 'sidebar__dialog u-margin--t-24',
  triggers: {
    'click .js-response': 'click:response',
  },
  template: FormSharingTemplate,
  templateContext() {
    const patient = this.model.getPatient();
    const sharing = this.model.get('sharing');
    const stateOptions = getSharingOpts(sharing);
    const isResponded = sharing === ACTION_SHARING.RESPONDED;

    return {
      stateOptions,
      isResponded,
      patient: patient.pick('first_name', 'last_name'),
    };
  },
});

const FormLayoutView = View.extend({
  className: 'patient-action__form',
  template: FormLayoutTemplate,
  regions: {
    form: {
      el: '[data-form-region]',
      regionClass: PreloadRegion,
    },
    formSharing: '[data-form-sharing-region]',
  },
  onRender() {
    this.showFormSharing();
  },
  showFormSharing() {
    if (!this.model.hasSharing()) return;

    const formSharingView = new FormSharingView({ model: this.model });

    this.listenTo(formSharingView, 'click:response', () => {
      this.triggerMethod('click:form', this.model.getForm());
    });

    this.showChildView('formSharing', formSharingView);
  },
});

export {
  FormLayoutView,
};
