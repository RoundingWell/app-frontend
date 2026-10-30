import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import SettingsService from './settings';

import { Model as Clinician } from 'js/entities-service/entities/clinicians';
import { Model as Workspace } from 'js/entities-service/entities/workspaces';
import { Collection as Settings } from 'js/entities-service/entities/settings';

context('Settings Service', function() {
  beforeEach(function() {
    const scope = testScope();
    const currentUser = new Clinician({ settings: { baz: 'clinician' } });

    scope.reply(Radio, 'bootstrap', 'currentUser', () => currentUser);

    const currentWorkspace = new Workspace({ settings: { bar: 1, baz: 'workspace' } });

    scope.reply(Radio, 'workspace', 'current', () => currentWorkspace);

    const settings = new Settings([
      { id: 'foo', value: 'value' },
      { id: 'bar', value: 2 },
      { id: 'baz', value: 'organization' },
    ]);

    scope.own(new SettingsService({ settings }));
  });

  specify('Get Org Setting', function() {
    const setting = Radio.request('settings', 'get', 'foo');

    expect(setting).to.equal('value');
  });

  specify('Get Workspace Setting', function() {
    const setting = Radio.request('settings', 'get', 'bar');

    expect(setting).to.equal(1);
  });

  specify('Get Clinician Setting', function() {
    const setting = Radio.request('settings', 'get', 'baz');

    expect(setting).to.equal('clinician');
  });
});
