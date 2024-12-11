import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';
import dayjs from 'dayjs';

import trim from 'js/utils/formatting/trim';

const TYPE = 'comments';

const _Model = BaseModel.extend({
  type: TYPE,
  messages: {
    CommentEdited({ attributes }) {
      this.set({ edited_at: dayjs.utc().format(), ...attributes });
    },
    CommentRemoved() {
      this.destroy({ isDeleted: true });
    },
  },
  urlRoot() {
    if (this.isNew()) return `/api/actions/${ this.get('_action') }/relationships/comments`;

    return '/api/comments';
  },
  validate({ message }) {
    if (!trim(message)) return 'Comment message required.';
  },
  getClinician() {
    return Radio.request('entities', 'clinicians:model', this.get('_clinician'));
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
