import Backbone from 'backbone';
import { filter, map, uniq } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';
import i18n from 'js/i18n';
import createLatestRequest from 'js/utils/latest-request';

import App from 'js/base/app';

import { InteractionEventsView, InteractionEventsLoadingView, InteractionEventsErrorView } from './interaction-details_views';

const intl = i18n.patients.patient.interactions;

const InteractionDetailsApp = App.extend({
  onBeforeStart(app, { interaction }) {
    this.requests = createLatestRequest({
      load: async(input, { signal }) => {
        const events = new Backbone.Collection();
        let cursor;
        do {
          const page = await Radio.request('entities', 'fetch:events:collection:byInteraction', {
            interactionId: interaction.id, cursor,
          }, { signal });
          signal.throwIfAborted();
          events.add(page.models);
          cursor = page.getMeta('next_cursor');
        } while (cursor);
        const editors = uniq(events.map(event => event.getEditor()));
        await Promise.all(map(filter(editors, editor => editor?.id && !editor.has('name')), editor => {
          return Radio.request('entities', 'fetch:clinicians:model', editor.id, { signal });
        }));
        signal.throwIfAborted();
        return events;
      },
      commit: collection => this.showView(new InteractionEventsView({ collection })),
      fail: () => this.showView(new InteractionEventsErrorView()),
    });
    this.showView(new InteractionEventsLoadingView());
  },
  prepareStart(options, { signal }) {
    return this.requests.run(null, { signal });
  },
  onBeforeDestroy() {
    this.requests?.dispose();
  },
});

export function showInteractionDetails(interaction, host) {
  const modal = Radio.request('modal', 'show', {
    headingText: intl.detailsTitle,
    submitText: intl.done,
    cancelText: false,
    className: 'modal interaction-details-modal',
    attributes: { 'role': 'dialog', 'aria-modal': 'true', 'aria-label': intl.detailsTitle },
  });
  const app = new InteractionDetailsApp({ region: modal.getRegion('body') });
  app.listenTo(host, 'before:destroy', () => modal.destroy());
  app.listenTo(modal, 'before:destroy', () => {
    app.requests?.dispose();
    app.destroy().catch(addError);
  });
  app.start({ interaction }).catch(addError);
}
