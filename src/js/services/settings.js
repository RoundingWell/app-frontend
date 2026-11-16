import { get, isUndefined } from 'underscore';
import { Radio } from 'marionette';

import App from 'js/base/app';

export default App.extend({
  channelName: 'settings',
  radioRequests: {
    'get': 'getSetting',
    'get:organization': 'getOrganizationSetting',
  },
  initialize({ settings }) {
    this.settings = settings;
  },
  getOrganizationSetting(settingName) {
    return this.settings.get(settingName)?.get('value');
  },
  getSetting(settingName) {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const clinicianSettings = currentUser.get('settings');
    const clinicianSetting = get(clinicianSettings, settingName);

    if (!isUndefined(clinicianSetting)) return clinicianSetting;

    const currentWorkspace = Radio.request('workspace', 'current');
    const workspaceSettings = currentWorkspace.get('settings');
    const workspaceSetting = get(workspaceSettings, settingName);

    if (!isUndefined(workspaceSetting)) return workspaceSetting;

    const setting = this.settings.get(settingName);

    /* istanbul ignore next */
    if (!setting) return;

    return setting.get('value');
  },
});
