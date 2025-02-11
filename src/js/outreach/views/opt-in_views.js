import { range } from 'underscore';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';
import parsePhoneNumber from 'libphonenumber-js/min';

import 'scss/modules/buttons.scss';
import 'scss/modules/forms.scss';
import 'scss/modules/select.scss';

import './opt-in.scss';

import trim from 'js/utils/formatting/trim';

const OptInView = View.extend({
  template: hbs`
    <div class="dialog__icon--warn">{{fat "hand-wave"}}</div>
    <h2 class="opt-in__heading-text">Hi, we need to confirm your contact info. Please enter your information below, so that we can share health resources with you.</h2>
    <div class="opt-in__field">
      <label class="opt-in__field-label">Your first name</label>
      <input
        type="text"
        class="input-primary opt-in__field-input js-first-name"
        placeholder="Enter your first name"
        value="{{ first_name }}"
      />
    </div>
    <div class="opt-in__field">
      <label class="opt-in__field-label">Your last name</label>
      <input
        type="text"
        class="input-primary opt-in__field-input js-last-name"
        placeholder="Enter your last name"
        value="{{ last_name }}"
      />
    </div>
    <div class="opt-in__field">
      <label class="opt-in__field-label">Your date of birth</label>
      <div class="select-wrapper u-margin--r-4">
        <select name="dob-month" class="select u-margin--r-8 js-dob-month ">
          <option value="">Month</option>
          {{#each dobMonthRange}}
            <option value={{this}}>{{this}}</option>
          {{/each}}
        </select>
      </div>
      <div class="select-wrapper u-margin--r-4">
        <select name="dob-day" class="select u-margin--r-8 js-dob-day">
          <option value="">Day</option>
          {{#each dobDayRange}}
            <option value={{this}}>{{this}}</option>
          {{/each}}
        </select>
      </div>
      <div class="select-wrapper">
        <select name="dob-year" class="select u-margin--r-8 js-dob-year">
          <option value="">Year</option>
          {{#each dobYearRange}}
            <option value={{this}}>{{this}}</option>
          {{/each}}
        </select>
      </div>
    </div>
    <h3 class="opt-in__heading-text u-margin--t-32 u-margin--b-16">How may we share health resources with you?</h3>
    <div class="opt-in__field">
      <label class="opt-in__field-label">Your mobile phone number</label>
      <input
        type="text"
        class="input-primary opt-in__field-input js-phone"
        placeholder="Enter mobile phone number"
        value="{{ phone }}"
      />
    </div>
    <p class="opt-in__disclaimer">By clicking Submit you agree to receive SMS text message notifications. You may opt out at any time.</p>
    <button class="opt-in__submit button--green w-100 js-submit" disabled>Submit</button>
  `,
  templateContext() {
    const dobMonthRange = range(1, 13);
    const dobDayRange = range(1, 32);
    const dobYearRange = range(1908, dayjs().add(1, 'year').year()).reverse();

    return {
      dobMonthRange,
      dobDayRange,
      dobYearRange,
    };
  },
  modelEvents: {
    'change': 'setSubmitButtonState',
  },
  ui: {
    firstName: '.js-first-name',
    lastName: '.js-last-name',
    dobMonth: '.js-dob-month',
    dobDay: '.js-dob-day',
    dobYear: '.js-dob-year',
    phone: '.js-phone',
    submit: '.js-submit',
  },
  triggers: {
    'input @ui.firstName': 'change:firstName',
    'input @ui.lastName': 'change:lastName',
    'change @ui.dobMonth': 'change:dobInput',
    'change @ui.dobDay': 'change:dobInput',
    'change @ui.dobYear': 'change:dobInput',
    'input @ui.phone': 'change:phone',
    'click @ui.submit': 'click:submit',
  },
  onRender() {
    this.setSubmitButtonState();
  },
  onChangeFirstName() {
    this.model.set({ first_name: trim(this.ui.firstName.val()) });
  },
  onChangeLastName() {
    this.model.set({ last_name: trim(this.ui.lastName.val()) });
  },
  onChangeDobInput() {
    const month = this.ui.dobMonth.val();
    const day = this.ui.dobDay.val();
    const year = this.ui.dobYear.val();

    if (!month || !day || !year) {
      this.model.set({ birth_date: '' });
      return;
    }

    this.model.set({
      birth_date: dayjs(`${ year }-${ month }-${ day }`).format('YYYY-MM-DD'),
    });
  },
  onChangePhone() {
    const phone = parsePhoneNumber(this.ui.phone.val(), 'US');

    this.model.set({ phone: phone ? phone.number : null });
  },
  disableSubmitButton() {
    this.ui.submit.prop('disabled', true);
  },
  enableSubmitButton() {
    this.ui.submit.prop('disabled', false);
  },
  setSubmitButtonState() {
    if (!this.model.isValid()) {
      this.disableSubmitButton();
      return;
    }

    this.enableSubmitButton();
  },
  onClickSubmit() {
    this.disableSubmitButton();
  },
});

const ResponseSuccessView = View.extend({
  template: hbs`
    <div class="dialog__icon--success">{{fat "thumbs-up"}}</div>
    <div class="opt-in__heading-text">Your contact info is confirmed. Thanks for doing that. We’ll notify you when we have a health resource to share with you.</div>
  `,
});

const ResponseErrorView = View.extend({
  template: hbs`
    <div class="dialog__icon--error">{{fat "octagon-exclamation"}}</div>
    <div class="opt-in__heading-text">We were not able to confirm your contact info. Sorry about that. Please contact your care team.</div>
    <div class="opt-in__heading-text u-text-link js-try-again">Try again</div>
  `,
  triggers: {
    'click .js-try-again': 'click:tryAgain',
  },
});

export {
  OptInView,
  ResponseSuccessView,
  ResponseErrorView,
};
