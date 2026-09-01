import Store from 'backbone.store';
import BaseModel from 'js/base/model';

const TYPE = 'artifacts';
const WRITABLE_ATTRIBUTES = [
  'artifact',
  'identifier',
  'values',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  type: TYPE,
  urlRoot: '/api/artifacts',
});

const Model = Store(_Model, TYPE);

export {
  _Model,
  Model,
};
