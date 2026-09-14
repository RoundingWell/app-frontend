import { includes, reject } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
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
    'fetch': 'fetchBootstrap',
  },
  getCurrentUser() {
    return this.getState().get('currentUser');
  },
  getOrganization() {
    return this.getState().get('organization');
  },
  getWorkspaces() {
    return this.getState().get('workspaces').clone();
  },
  // Returns roles that the current user can manage
  getActiveRoles() {
    if (activeRolesCache) return activeRolesCache;

    const state = this.getState();
    const canAdmin = state.get('currentUser').can('clinicians:admin');
    const activeRoles = getActiveRoles(state.get('roles'), canAdmin);

    activeRolesCache = Radio.request('entities', 'roles:collection', activeRoles);

    return activeRolesCache;
  },
  getTeams() {
    return this.getState().get('teams').clone();
  },
  createState() {
    return new Backbone.Model({
      organization: new Backbone.Model({ name: getAppName() }),
    });
  },
  initialize() {
    // NOTE: handle pre-init'd workspace requests
    Radio.reply('workspace', 'current');
  },
  async onBeforeStart(app, options, { signal }) {
    const results = await Promise.all([
      Radio.request('entities', 'fetch:clinicians:current', { signal }),
      Radio.request('entities', 'fetch:roles:collection', { signal }),
      Radio.request('entities', 'fetch:teams:collection', { signal }),
      Radio.request('entities', 'fetch:workspaces:collection', { signal }),
      Radio.request('entities', 'fetch:settings:collection', { signal }),
      Radio.request('entities', 'fetch:panels:collection', { signal }),
      Radio.request('entities', 'fetch:widgets:collection', { signal }),
    ]);

    if (signal.aborted) return;

    const [currentUser, roles, teams, workspaces, settings, panels, widgets] = results;
    this.getState().set({ currentUser, roles, teams, workspaces, settings, panels, widgets });
  },
  onStart() {
    const state = this.getState();

    new SettingsService({ settings: state.get('settings') });

    new SidebarsService({ panels: state.get('panels') });

    new WidgetsService({ widgets: state.get('widgets') });

    Radio.reset('workspace');
    new WorkspaceService({ route: getWorkspaceRoute() });

    Radio.request('dialer', 'init');
  },
  fetchBootstrap() {
    return this.start().then(() => this.getCurrentUser());
  },
});
