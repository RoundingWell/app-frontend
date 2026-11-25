import dayjs from 'dayjs';
import { contains, difference, filter, find, some, uniq } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { compareMessages } from 'js/entities-service/entities/messages';

import { InteractionsLoadingView } from 'js/apps/patients/shared/interactions/interactions-status_views';
import { isMessagingEnabled } from 'js/apps/patients/shared/messaging/availability';
import createComposerDraft from 'js/apps/patients/shared/messaging/composer_draft';

import { MessagesErrorView, MessagesView } from './messages_views';

export default App.extend({
  viewEvents: {
    'click:older': 'onClickOlder',
    'click:interactions': 'onClickInteractions',
    'select:date': 'onSelectDate',
    'send:message': 'onSendMessage',
  },
  onBeforeStart() {
    this.showView(new InteractionsLoadingView());
  },
  prepareStart({ patient }, { signal }) {
    this.query = {
      patientId: patient.id,
      limit: 25,
    };

    const composerRequest = isMessagingEnabled() && Radio.request('entities', 'fetch:patientFields:model', {
      _patient: patient.getResource(),
      name: 'phones',
    }, { signal })
      .then(phones => {
        const mobile = find(phones.get('value'), { label: 'mobile' });

        return { phone: mobile?.number };
      }, error => {
        signal.throwIfAborted();
        addError(error);
      });

    return Promise.all([
      Radio.request('entities', 'fetch:messages:window:initial', this.query, { signal }),
      composerRequest,
    ])
      .then(([initial, composer]) => ({ initial, composer }))
      .catch(error => {
        signal.throwIfAborted();
        return { error };
      });
  },
  onStart(app, { patient, action, viewport, focusOnLoad }, { initial, composer, error }) {
    this.patient = patient;
    this.action = action;
    this.phone = composer?.phone;

    if (error) {
      addError(error);
      this.showView(new MessagesErrorView());
    } else {
      this.window = initial;

      this.listenTo(Radio.channel('ws'), 'message:interactions', this.onInteractionMessage);

      const draft = composer && createComposerDraft({
        patientId: patient.id,
        actionId: action.id,
      });

      this.showView(new MessagesView({
        window: initial,
        patient,
        phone: this.phone,
        viewport,
        currentActionId: action.id,
        draft,
      }));
    }

    if (focusOnLoad) this.focus();
  },
  focus() {
    this.getRegion().focus();
  },
  onClickInteractions() {
    Radio.trigger('event-router', 'patient:interactions', this.patient.id);
  },
  onClickOlder() {
    this.loadOlder(signal => {
      return Radio.request('entities', 'fetch:messages:window:older', this.query, this.window, { signal });
    });
  },
  async onSelectDate(date) {
    const isShown = await this.loadOlder(signal => {
      return Radio.request('entities', 'fetch:messages:window:toDate', this.query, this.window, date, { signal });
    });

    if (!isShown) return;

    this.getView().scrollToDate(date);
  },
  async loadOlder(request) {
    this.olderController?.abort();

    const controller = new AbortController();
    this.olderController = controller;

    const startModels = this.window.models;
    this.getView().showOlderLoading();

    try {
      const older = await request(controller.signal);

      controller.signal.throwIfAborted();
      const added = difference(older.models, startModels);

      this.window = { ...this.window, oldest: older.oldest };
      this.showModels([...added, ...this.window.models], older.hasOlder);

      return true;
    } catch(error) {
      if (controller.signal.aborted) return false;

      addError(error);
      this.getView().showOlderError();

      return false;
    }
  },
  async onSendMessage(body) {
    const message = Radio.request('entities', 'messages:model', {
      body,
      status: 'queued',
      direction: 'outbound',
      phone: this.phone,
      sort_at: dayjs.utc().format(),
      send_status: 'sending',
      _patient: this.patient.getResource(),
      _action: this.action.getResource(),
    });

    this.showModels([...this.window.models, message]);

    const isSent = await message.save().then(() => true, error => {
      addError(error);
      return false;
    });

    if (!this.isRunning()) return;

    message.set('send_status', isSent ? null : 'failed');

    if (isSent || this.hasNewerPending) this.loadNewer();
  },
  onInteractionMessage({ category, payload }) {
    if (payload.patient?.id !== this.patient.id) return;
    if (category === 'ResourceCreated' && payload.attributes.channel !== 'message') return;

    this.loadNewer();
  },
  async loadNewer() {
    const hasSendingText = some(this.window.models, model => model.get('send_status') === 'sending');

    if (this.newerController || hasSendingText) {
      this.hasNewerPending = true;
      return;
    }

    this.hasNewerPending = false;

    const controller = new AbortController();
    this.newerController = controller;

    const newest = await Radio.request('entities', 'fetch:messages:window:initial', this.query, {
      signal: controller.signal,
    }).catch(addError);
    if (controller.signal.aborted) return;

    this.newerController = null;
    if (newest) this.showNewest(newest);
    if (this.hasNewerPending) this.loadNewer();
  },
  showNewest({ models, oldest, hasOlder }) {
    const cutoff = hasOlder && oldest;
    const kept = filter(this.window.models, model => {
      return model.get('send_status') || contains(models, model) || (cutoff && compareMessages(model, cutoff) < 0);
    });

    this.showModels([...kept, ...models]);
  },
  showModels(models, hasOlder = this.window.hasOlder) {
    this.window = { ...this.window, hasOlder, models: uniq(models).sort(compareMessages) };

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
