import Store from 'backbone.store';
import BaseModel from 'js/base/model';

const TYPE = 'artifacts';

const _Model = BaseModel.extend({
  type: TYPE,
  urlRoot: '/api/artifacts',
});

const Model = Store(_Model, TYPE);

export {
  _Model,
  Model,
};
