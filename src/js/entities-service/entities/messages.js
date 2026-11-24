import Store from 'backbone.store';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'messages';
const WRITABLE_ATTRIBUTES = [
  'body',
  'status',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  type: TYPE,
  urlRoot() {
    if (!this.isNew()) return '/api/messages';

    const action = this.get('_action');
    if (action) return `/api/actions/${ action.id }/messages`;

    return `/api/patients/${ this.get('_patient').id }/messages`;
  },
  getAuthor() {
    return this.getRelationship('_author');
  },
  queue() {
    return this.save({ status: 'queued' }, {}, { wait: true });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  model: Model,
});

export {
  _Model,
  Model,
  Collection,
};
