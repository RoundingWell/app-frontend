import { get } from 'underscore';
import Radio from 'backbone.radio';
import store from 'store';

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
      || workspaces.find({ id: store.get('currentWorkspace') })
      || workspaces.at(0);
  },
  _setCurrentWorkspace(route) {
    const workspace = this._getWorkspace(route);

    if (workspace.id !== get(this.currentWorkspace, 'id')) {
      store.set('currentWorkspace', workspace.id);
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
  beforeStart() {
    return [
      Radio.request('entities', 'fetch:programs:byWorkspace', this.currentWorkspace.id),
      Radio.request('entities', 'fetch:states:collection'),
      Radio.request('entities', 'fetch:forms:collection'),
    ];
  },
  onStart(options, programs) {
    const workspaces = this._getSharedWorkspaces(programs);

    const clinicianRequests = workspaces.map(workspace => {
      return Radio.request('entities', 'fetch:clinicians:byWorkspace', workspace.id);
    });

    Promise.all([...clinicianRequests])
      .then(() => {
        this.resolvePromise(this.currentWorkspace);
      })
      .catch((...args) => {
        this.rejectPromise(...args);
        this.stop();
      });
  },
  onFail(options, ...args) {
    this.rejectPromise(...args);
  },
  fetchWorkspace() {
    const promise = new Promise((resolvePromise, rejectPromise) => {
      this.resolvePromise = resolvePromise;
      this.rejectPromise = rejectPromise;
    });

    if (this.isRunning()) {
      this.restart();

      return promise;
    }

    this.start();

    return promise;
  },
});
