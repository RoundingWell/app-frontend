import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/textarea-flex.scss';

import trim from 'js/utils/formatting/trim';

import ComposerTemplate from './composer.hbs';

import './composer.scss';

const ComposerView = View.extend({
  className: 'messaging-composer',
  template: ComposerTemplate,
  ui: {
    input: '.js-input',
    spacer: '.js-spacer',
    send: '.js-send',
  },
  triggers: {
    'input @ui.input': 'input',
    'click @ui.send': 'click:send',
  },
  templateContext() {
    const patient = this.getOption('patient');

    return {
      patientName: `${ patient.get('first_name') } ${ patient.get('last_name') }`,
      firstName: patient.get('first_name'),
      phone: this.getOption('phone'),
    };
  },
  onInput() {
    const text = this.getUI('input')[0].value;

    this.getUI('spacer')[0].textContent = `${ text } `;
    this.getUI('send')[0].disabled = !trim(text);
  },
  onClickSend() {
    const message = trim(this.getUI('input')[0].value);

    this.getUI('input')[0].value = '';
    this.getUI('spacer')[0].textContent = ' ';
    this.getUI('send')[0].disabled = true;
    this.getUI('input')[0].focus();
    this.triggerMethod('send:message', message);
  },
});

export default ComposerView;
