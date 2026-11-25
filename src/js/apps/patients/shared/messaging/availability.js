import { Radio } from 'marionette';

export function isMessagingEnabled() {
  const organizationEnabled = Radio.request('settings', 'get:organization', 'messaging_enabled');
  const workspaceEnabled = Radio.request('workspace', 'current').get('settings').messaging_enabled;

  return organizationEnabled === true && workspaceEnabled !== false;
}

export function getMessagingPhone(field) {
  const { status, phone } = field.get('value') || {};

  return status === 'opted_in' ? phone : undefined;
}

// Program actions tagged `message` can have texts. Their history shows even when messaging is off.
export function canShowMessages(action) {
  return action.hasTag('message');
}
