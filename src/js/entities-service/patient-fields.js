import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/patient-fields';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'patientFields:model': 'getModel',
    'patientFields:collection': 'getCollection',
    'fetch:patientFields:model:history': 'getModelHistory',
  },
  getModelHistory({ _patient, name }, { limit, sort }) {
    const model = this.getModel({ _patient, name }).clone();
    const data = { page: { limit }, sort };
    return model.fetch({ url: `${ model.url() }/history`, data });
  },
});

export default new Entity();
