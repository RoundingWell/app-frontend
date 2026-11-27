import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/textarea-flex.scss';

import trim from 'js/utils/formatting/trim';

import ComposerTemplate from './composer.hbs';

import './composer.scss';

const ComposerView = View.extend({
  className() {
    return this.getOption('phone') ? 'messaging-composer' : 'messaging-composer messaging-composer--disabled';
  },
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
  // Without a phone, the box stays empty so the reason shows; a saved draft is kept for later.
  getBody() {
    return this.getOption('phone') ? this.model.get('body') : '';
  },
  templateContext() {
    const patient = this.getOption('patient');

    return {
      patientName: `${ patient.get('first_name') } ${ patient.get('last_name') }`,
      firstName: patient.get('first_name'),
      phone: this.getOption('phone'),
      body: this.getBody(),
      canSend: !!trim(this.getBody()),
    };
  },
  onRender() {
    // Set in JS: the HTML parser drops a leading newline inside <textarea>.
    this.getUI('input')[0].value = this.getBody();
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
});

export default ComposerView;
