import Store from 'backbone.store';
import dayjs from 'dayjs';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'messages';
const WRITABLE_ATTRIBUTES = [
  'body',
  'status',
];

export function compareMessages(left, right) {
  const diff = dayjs(left.get('sort_at')).diff(right.get('sort_at'));
  if (diff) return diff;
  if (left.isNew() !== right.isNew()) return left.isNew() ? -1 : 1;

  return String(left.id).localeCompare(String(right.id));
}

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
  getAction() {
    return this.getRelationship('_action');
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
