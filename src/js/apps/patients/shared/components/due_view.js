import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Datepicker from 'js/components/datepicker';

import './due-component.scss';

const i18n = intl.patients.shared.components.dueView;

const DueTemplate = hbs`
  <span class="due-component__value{{#if isOverdue}} due-component__value--overdue is-overdue{{/if}}">
    {{far "calendar-days"}}{{formatDateTime date dateFormat inputFormat="YYYY-MM-DD" defaultHtml=defaultHtml}}
  </span>
`;

export default View.extend({
  tagName: 'button',
  className: 'button button--compact due-component',
  attributes() {
    const attributes = { type: 'button' };

    if (this.getOption('isDisabled')) attributes.disabled = 'disabled';

    return attributes;
  },
  template: DueTemplate,
  templateContext() {
    return {
      defaultHtml: this.getOption('showLabel') ? `<span>${ i18n.defaultText }</span>` : '',
      dateFormat: 'SHORT',
      date: this.selected,
      isOverdue: !this.getOption('isDisabled') && this.getOption('isOverdue'),
    };
  },
  triggers: {
    'click': 'click',
  },
  initialize({ date }) {
    this.selected = date;
  },
  onRender() {
    this.el.setAttribute('aria-label', this.el.textContent.trim() || i18n.defaultText);
  },
  onClick() {
    this.isActive = !this.isActive;
    this.el.classList.toggle('is-active', this.isActive);

    if (!this.isActive) {
      this.datepicker?.destroy();
      return;
    }

    // blur off the button so enter won't trigger select repeatedly
    this.el.blur();
    this.showDatepicker();
  },
  showDatepicker() {
    const datepicker = this.datepicker = new Datepicker({
      uiView: this,
      position: { ...this.getBounds(), ignoreEl: this.el },
      stateOptions: { selectedDate: this.selected },
    });

    this.listenTo(datepicker, {
      'change:selectedDate'(date) {
        this.selected = date;
        this.render();
        this.triggerMethod('change:due', date);
        datepicker.destroy();
      },
      'destroy': this.onDatepickerDestroy,
    });

    datepicker.show();
  },
  onDatepickerDestroy() {
    this.datepicker = null;
    this.isActive = false;
    this.el.classList.remove('is-active');
  },
});
