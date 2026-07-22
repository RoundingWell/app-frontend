import { setUser, startRum } from 'js/datadog';
import { v7 as uuid } from 'uuid';
import Radio from 'backbone.radio';
import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/clinicians';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'clinicians:model': 'getModel',
    'clinicians:collection': 'getCollection',
    'fetch:clinicians:collection': 'fetchCollection',
    'fetch:clinicians:current': 'fetchCurrentClinician',
    'fetch:clinicians:model': 'fetchModel',
    'fetch:clinicians:byWorkspace': 'fetchByWorkspace',
  },
  fetchCurrentClinician() {
    return this.fetchByCache('/api/clinicians/me', { cacheScope: 'user' })
      .then(currentUser => {
        setUser(currentUser.pick('id', 'name', 'email'));
        startRum();
        currentUser.clientKey = uuid();
        return currentUser;
      });
  },
  fetchByWorkspace(workspaceId) {
    const url = `/api/workspaces/${ workspaceId }/clinicians`;
    const workspace = Radio.request('entities', 'workspaces:model', workspaceId);

    return this.fetchCollectionCache({ url })
      .then(clinicians => {
        workspace.updateClinicians(clinicians);
      });
  },
});

export default new Entity();
