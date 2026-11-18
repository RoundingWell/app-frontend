import dayjs from 'dayjs';
import { difference, filter, find, last } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { MessagesLoadingView, MessagesErrorView, MessagesView } from './messages_views';

const PAGE_LIMIT = 25;

export default App.extend({
  viewEvents: {
    'click:older': 'onClickOlder',
    'click:interactions': 'onClickInteractions',
    'select:date': 'onSelectDate',
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
  onStart(app, { patient, action, viewport, focusOnLoad }, { window, phone, error }) {
    this.patient = patient;
    this.action = action;
    this.phone = phone;

    if (error) {
      addError(error);
      this.showView(new MessagesErrorView());
    } else {
      this.window = window;
      this.showView(new MessagesView({ window, patient, phone, viewport, currentActionId: action.id }));
    }

    if (focusOnLoad) this.focus();
  },
  focus() {
    this.getRegion().focus();
  },
  onClickInteractions() {
    // The newest text sent or received on this action; scheduled, cancelled and unsaved texts are skipped.
    const newest = last(filter(this.window.models, model => model.getAction()?.id === this.action.id && model.get('occurred_at') && !model.isNew()));

    if (!newest) {
      Radio.trigger('event-router', 'patient:interactions', this.patient.id);
      return;
    }

    Radio.trigger('event-router', 'patient:interaction', this.patient.id, newest.id);
  },
  onClickOlder() {
    return this.loadOlder(signal => Radio.request('entities', 'fetch:interactions:window:adjacent', this.query, this.window, 'older', { signal }));
  },
  async onSelectDate(date) {
    if (await this.loadOlder(signal => Radio.request('entities', 'fetch:interactions:window:toDate', this.query, this.window, date, { signal }))) {
      this.getView().scrollToDate(date);
    }
  },
  // Loads older texts; a newer load replaces a pending one. Resolves true once shown.
  async loadOlder(request) {
    this.olderController?.abort();
    const controller = this.olderController = new AbortController();
    const startModels = this.window.models;
    this.getView().showOlderLoading();
    try {
      const window = await request(controller.signal);
      controller.signal.throwIfAborted();
      // Keep texts sent while the older texts loaded.
      this.window = { ...window, models: [...window.models, ...difference(this.window.models, startModels)] };
      this.getView().showWindow(this.window);
      return true;
    } catch(error) {
      if (controller.signal.aborted) return false;
      addError(error);
      this.getView().showOlderError();
      return false;
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
