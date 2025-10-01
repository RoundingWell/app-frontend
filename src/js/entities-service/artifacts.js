import { v5 as uuid } from 'uuid';
import BaseEntity from 'js/base/entity-service';
import { RWELL_NS } from 'js/static';
import { _Model, Model } from './entities/artifacts';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model },
  radioRequests: {
    'save:artifacts:model': 'saveModel',
  },
  saveModel({ artifact, identifier, values }) {
    const id = uuid(`${ artifact }:${ identifier }`, RWELL_NS);
    const model = this.getModel({ artifact, identifier, id, values });
    return model.save();
  },
});

export default new Entity();
