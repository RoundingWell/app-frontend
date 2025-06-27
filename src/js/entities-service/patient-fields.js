import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/patient-fields';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'patientFields:model': 'getModel',
    'patientFields:collection': 'getCollection',
  },
});

export default new Entity();
