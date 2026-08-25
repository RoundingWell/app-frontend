import Radio from 'backbone.radio';
import Store from 'backbone.store';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'panels';

const _Model = BaseModel.extend({
  type: TYPE,
  getWidgets() {
    return Radio.request('widgets', 'build', this.get('widgets'));
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/panels',
  model: Model,
});

export {
  _Model,
  Model,
  Collection,
};
