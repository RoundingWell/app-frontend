import { mapObject } from 'underscore';
import Backbone from 'backbone';

import EventRouter from '../event-router.js';

// Compatibility transport: borrows the existing native history owner. A custom
// transport implements connect(table, { onRoute, onNoMatch }) and write(url,
// { replace }); it must preserve the host's matching/dispatch/write policies.
export function createBackboneRouteTransport({ channel, history = Backbone.history }) {
  return {
    connect(table, { onRoute, onNoMatch }) {
      const router = new EventRouter({ channel, history, routeTriggers: table.triggers });
      router.listenTo(channel, mapObject(table.triggers, (patterns, event) => {
        return (...args) => onRoute(table.context(event, args));
      }));
      router.on('noMatch', onNoMatch);
      return {
        // Compatibility escape hatch for ErrorApp's fallback registration only.
        router,
        dispose: () => router.destroy(),
      };
    },
    write(url, { replace = false } = {}) {
      return history.navigate(url, { trigger: false, replace });
    },
  };
}
