import { get } from 'underscore';
import { Radio } from 'marionette';

export function isMessagingEnabled() {
  const organizationEnabled = Radio.request('settings', 'get:organization', 'messaging_enabled');
  const workspaceEnabled = Radio.request('workspace', 'current').get('settings').messaging_enabled;
  return organizationEnabled === true && workspaceEnabled !== false;
}

export function canShowMessages(action) {
  return isMessagingEnabled() && get(action.get('options'), 'embed') === 'compose';
}
