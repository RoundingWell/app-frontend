import Backbone from 'backbone';
import { Radio } from 'marionette';

import sessionStore from 'js/utils/session-store';

function createComposerDraft({ patientId, actionId }) {
  const clinicianId = Radio.request('bootstrap', 'currentUser').id;
  const workspaceId = Radio.request('workspace', 'current').id;
  const sessionScope = `${ clinicianId }_${ workspaceId }`;
  const key = `messaging-composer:${ JSON.stringify([sessionScope, patientId, actionId]) }`;

  const draft = new Backbone.Model({ body: sessionStore.get(key) || '' });

  draft.on('change:body', (model, body) => {
    if (!body) {
      sessionStore.remove(key);
      return;
    }

    sessionStore.set(key, body);
  });

  return draft;
}

export default createComposerDraft;
