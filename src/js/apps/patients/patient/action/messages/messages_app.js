import dayjs from 'dayjs';
import { contains, difference, filter, find, last, reject, some, uniq } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { compareInteractions } from 'js/entities-service/entities/interactions';

import { isMessagingEnabled } from 'js/apps/patients/shared/messaging/availability';
import createComposerDraft from 'js/apps/patients/shared/messaging/composer_draft';

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
    // Without messaging, the history shows and the composer does not.
    const phone = isMessagingEnabled() && Radio.request('entities', 'fetch:patientFields:model', { _patient: patient.getResource(), name: 'phones' }, { signal })
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
      this.deletedIds = [];
      this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
      const draft = phone && createComposerDraft({ patientId: patient.id, actionId: action.id });
      this.showView(new MessagesView({ window, patient, phone, viewport, currentActionId: action.id, draft }));
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
      // Only the older texts are new; keep everything shown since the load began.
      this.showModels([...difference(window.models, startModels), ...this.window.models], window.hasOlder);
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

    this.showModels([...this.window.models, text]);

    const isSent = await text.saveAll().then(() => true, error => {
      addError(error);
      return false;
    });

    text.set('send_status', isSent ? null : 'failed');

    if (this.hasNewerPending) this.loadNewer();
  },
  onInteractionMessage({ category, payload }, model) {
    if (payload.patient?.id !== this.patient.id) return;

    if (category === 'ResourceCreated') {
      if (payload.attributes.channel === 'sms') this.loadNewer();
      return;
    }

    // A text not shown yet can still be deleted before a load returns it.
    if (category === 'ResourceDeleted') this.deletedIds.push(model.id);

    if (!contains(this.window.models, model)) return;

    this.showModels(this.window.models);
  },
  // Loads the newest texts and adds any not shown. One load at a time, and none while a text sends: the load could return that text before the send gives it an id, showing it twice.
  async loadNewer() {
    if (this.newerController || some(this.window.models, model => model.get('send_status') === 'sending')) {
      this.hasNewerPending = true;
      return;
    }

    this.hasNewerPending = false;
    const controller = this.newerController = new AbortController();

    const window = await Radio.request('entities', 'fetch:interactions:window:initial', this.query, { signal: controller.signal }).catch(addError);
    if (controller.signal.aborted) return;

    this.newerController = null;
    if (window) this.showModels([...this.window.models, ...window.models]);
    if (this.hasNewerPending) this.loadNewer();
  },
  showModels(models, hasOlder = this.window.hasOlder) {
    const shown = reject(uniq(models), model => contains(this.deletedIds, model.id));
    this.window = { ...this.window, hasOlder, models: shown.sort(compareInteractions) };
    this.getView().showWindow(this.window);
  },
  onStop() {
    this.olderController?.abort();
    this.newerController?.abort();
    this.newerController = null;
    this.hasNewerPending = false;
    this.stopListening(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);
  },
});
