import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/forms.scss';
import 'scss/modules/textarea-flex.scss';
import 'scss/modules/sidebar.scss';

import { ACTION_SHARING } from 'js/static';

import FormSharingTemplate from './form-sharing.hbs';

import './action-sidebar.scss';

const FormView = View.extend({
  attributes() {
    return {
      disabled: !!this.getOption('isShowingForm'),
    };
  },
  tagName: 'button',
  className: 'button-secondary w-100 action-sidebar__form',
  template: hbs`{{far "square-poll-horizontal"}}<span>{{ name }}</span>`,
  triggers: {
    'click': 'click',
  },
});

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
    'click .js-share': 'click:share',
    'click .js-cancel': 'click:cancelShare',
    'click .js-undo-cancel': 'click:undoCancelShare',
    'click .js-response': 'click:response',
  },
  template: FormSharingTemplate,
  templateContext() {
    const patient = this.model.getPatient();
    const sharing = this.model.get('sharing');
    const stateOptions = getSharingOpts(sharing);
    const isPending = sharing === ACTION_SHARING.PENDING;
    const isSent = sharing === ACTION_SHARING.SENT;
    const isResponded = sharing === ACTION_SHARING.RESPONDED;
    const isCanceled = sharing === ACTION_SHARING.CANCELED;

    return {
      stateOptions,
      isWaiting: isSent || isPending,
      isResponded,
      isCanceled,
      isError: !isPending && !isSent && !isResponded && !isCanceled,
      patient: patient.pick('first_name', 'last_name'),
      isDone: this.model.isDone(),
    };
  },
});

const FormLayoutView = View.extend({
  modelEvents: {
    'change:sharing': 'onChangeSharing',
    'change:_state': 'onChangeActionState',
  },
  childViewTriggers: {
    'click:share': 'click:share',
    'click:cancelShare': 'click:cancelShare',
    'click:undoCancelShare': 'click:undoCancelShare',
  },
  template: hbs`
    <div class="flex{{#if hasForm}} u-margin--t-8{{/if}}">
      {{#if hasForm}}<h4 class="sidebar__label u-margin--t-8">{{ @intl.patients.sidebar.action.actionSidebarFormsViews.formLayoutView.formLabel }}</h4>{{/if}}
      <div class="flex-grow" data-form-region></div>
    </div>
    <div class="flex">
      <div class="flex-grow" data-form-sharing-region></div>
    </div>
  `,
  templateContext() {
    return {
      hasForm: !!this.model.getForm(),
    };
  },
  regions: {
    form: '[data-form-region]',
    formSharing: '[data-form-sharing-region]',
  },
  onChangeSharing() {
    this.showFormSharing();
  },
  onChangeActionState() {
    this.showFormSharing();
  },
  onRender() {
    this.showForm();
    this.showFormSharing();
  },
  showForm() {
    const form = this.model.getForm();
    if (!form) return;

    const formView = new FormView({
      model: form,
      isShowingForm: this.getOption('isShowingForm'),
    });

    this.listenTo(formView, 'click', () => {
      this.triggerMethod('click:form', form);
    });

    this.showChildView('form', formView);
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
