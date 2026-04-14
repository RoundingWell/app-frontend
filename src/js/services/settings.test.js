import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import Radio from 'backbone.radio';

import SettingsService from 'js/services/settings';

import { Model as Clinician } from 'js/entities-service/entities/clinicians';
import { Model as Workspace } from 'js/entities-service/entities/workspaces';
import { Collection as Settings } from 'js/entities-service/entities/settings';

describe('Settings Service', () => {
  let service;

  beforeEach(() => {
    const currentUser = new Clinician({ settings: { baz: 'clinician' } });
    Radio.reply('bootstrap', 'currentUser', () => currentUser);

    const currentWorkspace = new Workspace({ settings: { bar: 1, baz: 'workspace' } });
    Radio.reply('workspace', 'current', () => currentWorkspace);

    const settings = new Settings([
      { id: 'foo', value: 'value' },
      { id: 'bar', value: 2 },
      { id: 'baz', value: 'organization' },
    ]);

    service = new SettingsService({ settings });
  });

  afterEach(() => {
    Radio.reset('bootstrap');
    Radio.reset('workspace');
    service.destroy();
  });

  it('gets an organization setting', () => {
    expect(Radio.request('settings', 'get', 'foo')).toBe('value');
  });

  it('gets a workspace setting before the organization setting', () => {
    expect(Radio.request('settings', 'get', 'bar')).toBe(1);
  });

  it('gets a clinician setting before workspace and organization settings', () => {
    expect(Radio.request('settings', 'get', 'baz')).toBe('clinician');
  });
});
