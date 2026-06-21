import { extend } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';
import { mixinState } from 'marionette.toolkit';

import 'scss/modules/modals.scss';

import DateSelectComponent from 'js/components/dateselect';
import Droplist from 'js/components/droplist';
import WorkspacesManagerComponent from 'js/components/workspaces-manager';

import intl from 'js/i18n';
import trim from 'js/utils/formatting/trim';

import InputFocusBehavior from 'js/behaviors/input-focus';
import PatientModalTemplate from './patient-modal.hbs';

import './patient-modal.scss';

const i18n = intl.globals.patientModal.patientModalViews;

const InputView = View.extend({
  behaviors() {
    if (!this.getOption('shouldFocus')) return;

    return [
      {
        behaviorClass: InputFocusBehavior,
        selector: '.js-input',
      },
    ];
  },
  className: 'pos--relative',
  template: hbs`
    <input class="input-primary w-100 js-input {{#if hasError}}has-error{{/if}}" placeholder="{{ placeholder }}" value="{{ value }}" {{#unless canEdit}}disabled{{/unless}} />
    {{#unless canEdit}}<span class="patient-modal__locked-icon">{{far "lock"}}</span>{{/unless}}
  `,
  templateContext() {
    const errors = this.getOption('state').get('errors');

    return {
      hasError: errors && errors[this.getOption('errorField')],
      placeholder: this.getOption('placeholder'),
      value: this.model.get(this.getOption('attr')),
      canEdit: this.model.canEdit(),
    };
  },
  ui: {
    input: '.js-input',
  },
  events: {
    'input @ui.input': 'onChange',
  },
  initialize({ state }) {
    this.listenTo(state, 'change:errors', this.render);
  },
  onChange() {
    const text = this.ui.input.val();
    this.model.set(this.getOption('attr'), trim(text));
  },
  onDomRefresh() {
    if (this.getOption('shouldFocus')) {
      this.ui.input.focus();
    }
  },
});

const SexDroplist = Droplist.extend({
  initialize({ model }) {
    const patientSex = model.get('sex');

    this.collection = new Backbone.Collection([
      {
        text: i18n.sexDroplist.male,
        value: 'm',
      },
      {
        text: i18n.sexDroplist.female,
        value: 'f',
      },
      {
        text: i18n.sexDroplist.other,
        value: 'u',
      },
    ]);

    this.setState('selected', this.collection.find({ value: patientSex }));
  },
  viewOptions: {
    className: 'button-secondary modal__form-component',
    template: hbs`{{far "user"}}<span>{{ text }}{{#unless text}}{{ @intl.globals.patientModal.patientModalViews.sexDroplist.defaultText }}{{/unless}}</span>`,
  },
});

const BirthdateView = View.extend({
  className: 'modal__form-component',
  template: hbs`<div data-date-select-region></div>`,
  regions: {
    dateSelect: {
      el: '[data-date-select-region]',
      replaceElement: true,
    },
  },
  onChangeDate(state, date) {
    state.set('hasError', date && date.isAfter());
    this.triggerMethod('change:selected', date);
  },
  onRender() {
    const birthdateSelect = new DateSelectComponent({
      state: {
        selectedDate: this.model.get('birth_date'),
        isDisabled: !this.model.canEdit(),
      },
      viewOptions: {
        className: 'flex',
      },
    });

    this.listenTo(birthdateSelect, 'change:date', this.onChangeDate);

    this.showChildView('dateSelect', birthdateSelect);
  },
});

const ErrorView = View.extend({
  className: 'modal__footer-info modal__error',
  template: hbs`{{ error }}{{#if hasSearch}} <a class="u-margin--l-8 u-text-link js-search">{{@intl.globals.patientModal.patientModalViews.errorView.searchBtn}}</a>{{/if}}`,
  templateContext() {
    return {
      error: this.getOption('error') || i18n.errorView.errors[this.getOption('errorCode')],
      hasSearch: this.getOption('hasSearch'),
    };
  },
  triggers: {
    'click .js-search': 'click:search',
  },
});

const PatientModal = View.extend({
  className: 'modal__content',
  regions: {
    firstName: '[data-first-name-region]',
    lastName: '[data-last-name-region]',
    dob: '[data-dob-region]',
    sex: '[data-sex-region]',
    workspaces: '[data-workspaces-region]',
  },
  modelEvents: {
    'change': 'onChange',
  },
  template: PatientModalTemplate,
  templateContext() {
    return {
      isNew: this.model.isNew(),
      canEdit: this.model.canEdit(),
    };
  },
  initialize({ state }) {
    this.initState({ state });
  },
  onRender() {
    this.showFirstNameView();
    this.showLastNameView();
    this.showSexDroplist();
    this.showBirthDatePicker();
    this.showWorkspacesComponent();
  },
  showFirstNameView() {
    this.showChildView('firstName', new InputView({
      model: this.model,
      state: this.getState(),
      attr: 'first_name',
      placeholder: i18n.patientModal.firstName,
      errorField: 'name',
      shouldFocus: true,
    }));
  },
  showLastNameView() {
    this.showChildView('lastName', new InputView({
      model: this.model,
      state: this.getState(),
      attr: 'last_name',
      placeholder: i18n.patientModal.lastName,
      errorField: 'name',
    }));
  },
  showSexDroplist() {
    const sexDroplist = this.showChildView('sex', new SexDroplist({
      model: this.model,
      state: {
        isDisabled: !this.model.canEdit(),
      },
    }));

    this.listenTo(sexDroplist, {
      'change:selected'(selected) {
        this.model.set('sex', selected.get('value'));
      },
    });
  },
  showBirthDatePicker() {
    const birthDatePicker = this.showChildView('dob', new BirthdateView({
      model: this.model,
      state: this.getState(),
    }));

    this.listenTo(birthDatePicker, {
      'change:selected'(date) {
        this.model.set('birth_date', date ? date.format('YYYY-MM-DD') : null);
      },
    });
  },
  showWorkspacesComponent() {
    if (this.model.isNew()) return;

    const currentUser = Radio.request('bootstrap', 'currentUser');

    this.showChildView('workspaces', new WorkspacesManagerComponent({
      member: this.model,
      workspaces: currentUser.getWorkspaces(),
      isDisabled: true,
    }));
  },
});

mixinState(PatientModal);

function getPatientModal(opts) {
  const patient = opts.patient;
  const bodyView = new PatientModal({
    model: patient,
  });

  const canEdit = patient.canEdit();

  if (canEdit) {
    const type = patient.isNew() ? 'add' : 'edit';
    const { submit_text: submitText } = Radio.request('settings', 'get', 'patient_creation_form') || {};

    if (submitText && patient.isNew()) {
      extend(opts, { submitText });
    }

    return extend({
      bodyView,
      headerIcon: 'address-card',
    }, i18n.patientModal[type], opts);
  }

  return extend({
    bodyView,
    cancelText: false,
    headerIcon: 'address-card',
    infoText: i18n.patientModal.patientAccountManaged,
  }, i18n.patientModal.view, opts);
}

export {
  ErrorView,
  getPatientModal,
};
