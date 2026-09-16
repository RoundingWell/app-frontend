import { includes, reject } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';
import { getAppName } from '@roundingwell/care-ops-config';

import getWorkspaceRoute from 'js/utils/root-route';

import App from 'js/base/app';

import SidebarsService from './sidebars';
import SettingsService from './settings';
import WidgetsService from './widgets';
import WorkspaceService from './workspace';

// NOTE: Roles are set only at login so they can be cached
let activeRolesCache;

function getActiveRoles(roles, canAdmin) {
  const activeRoles = roles.reject({ name: 'patient' });

  if (canAdmin) return activeRoles;

  return reject(activeRoles, role => {
    return includes(role.get('permissions'), 'clinicians:admin');
  });
}

export default App.extend({
  channelName: 'bootstrap',
  radioRequests: {
    'currentUser': 'getCurrentUser',
    'workspaces': 'getWorkspaces',
    'organization': 'getOrganization',
    'roles': 'getActiveRoles',
    'teams': 'getTeams',
  },
  getCurrentUser() {
    return this.currentUser;
  },
  getOrganization() {
    return this.organization;
  },
  getWorkspaces() {
    return this.workspaces.clone();
  },
  // Returns roles that the current user can manage
  getActiveRoles() {
    if (activeRolesCache) return activeRolesCache;

    const canAdmin = this.currentUser.can('clinicians:admin');
    const activeRoles = getActiveRoles(this.roles, canAdmin);

    activeRolesCache = Radio.request('entities', 'roles:collection', activeRoles);

    return activeRolesCache;
  },
  getTeams() {
    return this.teams.clone();
  },
  initialize() {
    this.organization = new Backbone.Model({ name: getAppName() });

    // NOTE: handle pre-init'd workspace requests
    Radio.reply('workspace', 'current');
  },
  prepareStart(options, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:clinicians:current', { signal }),
      Radio.request('entities', 'fetch:roles:collection', { signal }),
      Radio.request('entities', 'fetch:teams:collection', { signal }),
      Radio.request('entities', 'fetch:workspaces:collection', { signal }),
      Radio.request('entities', 'fetch:settings:collection', { signal }),
      Radio.request('entities', 'fetch:panels:collection', { signal }),
      Radio.request('entities', 'fetch:widgets:collection', { signal }),
    ]);
  },
  onStart(app, options, [currentUser, roles, teams, workspaces, settings, panels, widgets]) {
    this.currentUser = currentUser;
    this.roles = roles;
    this.teams = teams;
    this.workspaces = workspaces;

    new SettingsService({ settings });

    new SidebarsService({ panels });

    new WidgetsService({ widgets });

    if (!this.hasChildApp('workspace')) {
      Radio.channel('workspace').reset();
      this.addChildApp('workspace', new WorkspaceService({ route: getWorkspaceRoute() }));
    }

    Radio.request('dialer', 'init');
  },
});
