import { extend } from 'underscore';
import { v5 as uuid } from 'uuid';
import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/patient-fields';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'patientFields:model': 'getPatientField',
    'patientFields:collection': 'getCollection',
  },
  getPatientField(attrs) {
    const id = uuid(`resource:field:${ attrs.name.toLowerCase() }`, attrs._patient.id);

    return this.getModel(extend({ id }, attrs));
  },
});

export default new Entity();
