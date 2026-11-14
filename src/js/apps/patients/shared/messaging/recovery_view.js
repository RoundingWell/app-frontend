import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import intl from 'js/i18n';
import { attemptedSend } from 'js/entities-service/messaging-prototype/send-attempts';

const copy = intl.patients.messaging;

export default View.extend({
  className: 'messaging-recovery',
  template: hbs`<p role="status">{{ status }}</p><button class="button button--text js-check" type="button" {{#if pending}}disabled{{/if}}>{{ copy.recover }}</button>`,
  ui: { check: '.js-check' },
  triggers: { 'click @ui.check': 'check:recording' },
  initialize() {
    this.listenTo(Radio.channel('messaging-prototype'), {
      'send:uncertain': this.onRecordingChanged,
      'interaction:recorded': this.onRecordingChanged,
    });
  },
  templateContext() {
    return { copy, pending: this.pending, status: this.status || copy.uncertain };
  },
  onRender() {
    this.el.hidden = !attemptedSend(this.getOption('patientId'));
  },
  onRecordingChanged({ patientId }) {
    if (patientId === this.getOption('patientId')) this.render();
  },
  async onCheckRecording() {
    this.controller = new AbortController();
    this.pending = true;
    this.render();
    try {
      const result = await Radio.request('entities', 'reconcile:messagingPrototype:send', { patientId: this.getOption('patientId') }, { signal: this.controller.signal });
      if (this.isDestroyed()) return;
      this.status = result.confirmed ? '' : copy.stillUncertain;
    } catch {
      if (this.isDestroyed()) return;
      this.status = copy.stillUncertain;
    }
    this.pending = false;
    this.render();
  },
  onBeforeDestroy() {
    this.controller?.abort();
  },
});
