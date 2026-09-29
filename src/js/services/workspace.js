import { get } from 'underscore';
import { Radio } from 'marionette';

import localStore from 'js/utils/local-store';

import App from 'js/base/app';

export default App.extend({
  channelName: 'workspace',
  radioRequests: {
    'current': 'getCurrentWorkspace',
    'fetch': 'fetchWorkspace',
  },
  _getWorkspace(slug) {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const workspaces = currentUser.getWorkspaces();

    if (!workspaces.length) throw 'No workspaces found';

    return workspaces.find({ slug })
      || workspaces.find({ id: localStore.get('currentWorkspace') })
      || workspaces.at(0);
  },
  _setCurrentWorkspace(route) {
    const workspace = this._getWorkspace(route);

    if (workspace.id !== get(this.currentWorkspace, 'id')) {
      localStore.set('currentWorkspace', workspace.id);
      this.currentWorkspace = workspace;
      this.getChannel().trigger('change:workspace', workspace);
    }

    return workspace;
  },
  getCurrentWorkspace(route) {
    if (route) {
      return this._setCurrentWorkspace(route);
    }

    return this.currentWorkspace;
  },
  _getSharedWorkspaces(programs) {
    const sharedWorkspaces = Radio.request('entities', 'workspaces:collection');

    programs.each(program => {
      const workspaces = program.getUserWorkspaces();

      sharedWorkspaces.add(workspaces.models);
    });

    return sharedWorkspaces;
  },
  initialize({ route }) {
    this._setCurrentWorkspace(route);
  },
  async fetchWorkspace({ workspace, signal }) {
    const [programs] = await Promise.all([
      Radio.request(
        'entities',
        'fetch:programs:byWorkspace',
        workspace.id,
        { signal },
      ),
      Radio.request('entities', 'fetch:states:collection', { signal }),
      Radio.request('entities', 'fetch:forms:collection', { signal }),
    ]);

    signal.throwIfAborted();

    const workspaces = this._getSharedWorkspaces(programs);

    const clinicianRequests = workspaces.map(sharedWorkspace => {
      return Radio.request(
        'entities',
        'fetch:clinicians:byWorkspace',
        sharedWorkspace.id,
        { signal },
      );
    });

    await Promise.all(clinicianRequests);

    signal.throwIfAborted();

    return workspace;
  },
});
