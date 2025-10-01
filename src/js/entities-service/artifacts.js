import BaseEntity from 'js/base/entity-service';
import BaseModel from 'js/base/model';

const Artifact = BaseModel.extend({
  url() {
    return '/api/artifacts';
  },
});

const Entity = BaseEntity.extend({
  radioRequests: {
    'artifacts:model': 'getModel',
  },
  getModel(attrs) {
    return new Artifact(attrs);
  },
});

export default new Entity();
