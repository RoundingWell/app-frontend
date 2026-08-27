import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';
import dayjs from 'dayjs';

import trim from 'js/utils/formatting/trim';

const TYPE = 'comments';
const WRITABLE_ATTRIBUTES = [
  'message',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  type: TYPE,
  messages: {
    CommentEdited({ attributes }) {
      this.set({ edited_at: dayjs.utc().format(), ...attributes });
    },
    CommentRemoved() {
      const action = this.getAction();

      action.removeComment(this);

      this.destroy({ isDeleted: true });
    },
  },
  urlRoot() {
    if (this.isNew()) return `/api/actions/${ this.getAction().id }/relationships/comments`;

    return '/api/comments';
  },
  validate({ message }) {
    if (!trim(message)) return 'Comment message required.';
  },
  getClinician() {
    return this.getRelationship('_clinician');
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
