import Radio from 'backbone.radio';
import BaseEntity from 'js/base/entity-service';
import { _Model, Model } from './entities/workspace-patients';
import { v5 as uuid } from 'uuid';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model },
  radioRequests: {
    'get:workspacePatients:model': 'getByPatient',
    'fetch:workspacePatients:byPatient': 'fetchByPatient',
  },
  fetchByPatient(patientId) {
    const model = this.getByPatient(patientId);

    return model.fetch();
  },
  getByPatient(patientId) {
    const currentWorkspace = Radio.request('workspace', 'current');

    return new Model({
      id: uuid(patientId, currentWorkspace.id),
      _patient: { id: patientId, type: 'patients' },
      _workspace: currentWorkspace.getResource(),
    });
  },
});

export default new Entity();
