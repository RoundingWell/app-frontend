import Store from 'backbone.store';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'interactions';

const _Model = BaseModel.extend({
  type: TYPE,
  getAction() {
    return this.getRelationship('_action');
  },
  getFlow() {
    return this.getRelationship('_flow');
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({ model: Model });

export { _Model, Model, Collection };
