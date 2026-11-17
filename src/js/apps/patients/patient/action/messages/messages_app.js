import dayjs from 'dayjs';
import { find } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { MessagesLoadingView, MessagesErrorView, MessagesView } from './messages_views';

const PAGE_LIMIT = 25;

export default App.extend({
  viewEvents: {
    'click:older': 'onClickOlder',
    'send:message': 'onSendMessage',
  },
  onBeforeStart() {
    this.showView(new MessagesLoadingView());
  },
  prepareStart({ patient }, { signal }) {
    this.query = { patientId: patient.id, channels: ['sms'], limit: PAGE_LIMIT };
    const phone = Radio.request('entities', 'fetch:patientFields:model', { _patient: patient.getResource(), name: 'phones' }, { signal })
      .then(phones => find(phones.get('value'), { label: 'mobile' })?.number, error => {
        signal.throwIfAborted();
        addError(error);
      });

    return Promise.all([
      Radio.request('entities', 'fetch:interactions:window:initial', this.query, { signal }),
      phone,
    ])
      .then(([window, mobile]) => ({ window, phone: mobile }))
      .catch(error => {
        signal.throwIfAborted();
        return { error };
      });
  },
  onStart(app, { patient, action, focusOnLoad }, { window, phone, error }) {
    this.patient = patient;
    this.action = action;
    this.phone = phone;

    if (error) {
      addError(error);
      this.showView(new MessagesErrorView());
    } else {
      this.window = window;
      this.showView(new MessagesView({ window, patient, phone, currentActionId: action.id }));
    }

    if (focusOnLoad) this.focus();
  },
  focus() {
    this.getRegion().focus();
  },
  async onClickOlder() {
    const controller = this.olderController = new AbortController();
    try {
      const window = await Radio.request('entities', 'fetch:interactions:window:adjacent', this.query, this.window, 'older', { signal: controller.signal });
      controller.signal.throwIfAborted();
      this.window = window;
      this.getView().showWindow(window);
    } catch(error) {
      if (controller.signal.aborted) return;
      addError(error);
      this.getView().showOlderError();
    }
  },
  async onSendMessage(message) {
    const text = Radio.request('entities', 'interactions:model', {
      channel: 'sms',
      direction: 'outbound',
      occurred_at: dayjs.utc().format(),
      metadata: { phone_number: this.phone, message },
      send_status: 'sending',
      _patient: this.patient.getResource(),
      _action: this.action.getResource(),
    });

    this.window = { ...this.window, models: [...this.window.models, text] };
    this.getView().showWindow(this.window);

    const isSent = await text.saveAll().then(() => true, error => {
      addError(error);
      return false;
    });

    text.set('send_status', isSent ? null : 'failed');
  },
  onStop() {
    this.olderController?.abort();
  },
});
