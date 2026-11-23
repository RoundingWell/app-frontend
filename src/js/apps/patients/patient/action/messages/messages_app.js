import dayjs from 'dayjs';
import { contains, difference, filter, find, last, reject, some, uniq } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { compareInteractions } from 'js/entities-service/entities/interactions';

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
      channels: ['sms'],
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
      Radio.request('entities', 'fetch:interactions:window:initial', this.query, { signal }),
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
      this.deletedIds = [];

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
    const newest = last(filter(this.window.models, model => {
      const isOnAction = model.getAction()?.id === this.action.id;

      return isOnAction && model.get('occurred_at') && !model.isNew();
    }));

    if (!newest) {
      Radio.trigger('event-router', 'patient:interactions', this.patient.id);
      return;
    }

    Radio.trigger('event-router', 'patient:interaction', this.patient.id, newest.id);
  },
  onClickOlder() {
    this.loadOlder(signal => {
      return Radio.request('entities', 'fetch:interactions:window:adjacent', this.query, this.window, 'older', { signal });
    });
  },
  async onSelectDate(date) {
    const isShown = await this.loadOlder(signal => {
      return Radio.request('entities', 'fetch:interactions:window:toDate', this.query, this.window, date, { signal });
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

      this.showModels([...added, ...this.window.models], older.hasOlder);

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
      metadata: {
        phone_number: this.phone,
        message,
      },
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

    if (category === 'ResourceDeleted') this.deletedIds.push(model.id);

    if (!contains(this.window.models, model)) return;

    this.showModels(this.window.models);
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

    const newest = await Radio.request('entities', 'fetch:interactions:window:initial', this.query, {
      signal: controller.signal,
    }).catch(addError);
    if (controller.signal.aborted) return;

    this.newerController = null;
    if (newest) this.showModels([...this.window.models, ...newest.models]);
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
