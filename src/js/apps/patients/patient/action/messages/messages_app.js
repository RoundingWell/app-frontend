import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import { MessagesLoadingView, MessagesErrorView, MessagesView } from './messages_views';

const PAGE_LIMIT = 25;

export default App.extend({
  viewEvents: {
    'click:older': 'onClickOlder',
  },
  onBeforeStart() {
    this.showView(new MessagesLoadingView());
  },
  prepareStart({ patient }, { signal }) {
    this.query = { patientId: patient.id, channels: ['sms'], limit: PAGE_LIMIT };
    return Radio.request('entities', 'fetch:interactions:window:initial', this.query, { signal })
      .catch(error => {
        signal.throwIfAborted();
        return { error };
      });
  },
  onStart(app, { patient, action, focusOnLoad }, window) {
    if (window.error) {
      addError(window.error);
      this.showView(new MessagesErrorView());
    } else {
      this.window = window;
      this.showView(new MessagesView({ window, patient, currentActionId: action.id }));
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
  onStop() {
    this.olderController?.abort();
  },
});
