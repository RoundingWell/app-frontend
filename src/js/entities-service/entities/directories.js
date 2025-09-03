import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'directories';

const Model = BaseModel.extend({
  type: TYPE,
  url() {
    return `/api/directory/${ this.get('slug') }`;
  },
});

const Collection = BaseCollection.extend({
  url: '/api/directories',
  model: Model,
});

export {
  Model,
  Collection,
};
