import { uniqueId } from 'underscore';
import { Radio } from 'marionette';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'widgets';

const _Model = BaseModel.extend({
  type: TYPE,
  fetchValues(patientId, options) {
    return Radio.request('entities', 'fetch:widgetValues:byPatient', this, patientId, options);
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/widgets',
  model: Model,
  modelId(attr) {
    return uniqueId(`${ attr.slug }-`);
  },
});

export {
  _Model,
  Model,
  Collection,
};
