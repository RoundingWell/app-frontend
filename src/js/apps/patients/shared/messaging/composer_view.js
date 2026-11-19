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
  modelEvents: {
    'change:body': 'onChangeBody',
  },
  templateContext() {
    const patient = this.getOption('patient');

    return {
      patientName: `${ patient.get('first_name') } ${ patient.get('last_name') }`,
      firstName: patient.get('first_name'),
      phone: this.getOption('phone'),
      canSend: !!trim(this.model.get('body')),
    };
  },
  onRender() {
    // Set in JS: the HTML parser drops a leading newline inside <textarea>.
    this.getUI('input')[0].value = this.model.get('body');
  },
  onInput() {
    this.model.set('body', this.getUI('input')[0].value);
  },
  onChangeBody(model, body) {
    // Skip when unchanged so typing doesn't move the cursor.
    if (this.getUI('input')[0].value !== body) this.getUI('input')[0].value = body;
    this.getUI('spacer')[0].textContent = `${ body } `;
    this.getUI('send')[0].disabled = !trim(body);
  },
  onClickSend() {
    const message = trim(this.model.get('body'));

    this.model.set('body', '');
    this.getUI('input')[0].focus();
    this.triggerMethod('send:message', message);
  },
  restore(message) {
    this.model.set('body', message);
  },
});

export default ComposerView;
