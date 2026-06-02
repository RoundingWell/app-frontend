import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/comments';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'comments:model': 'getModel',
    'comments:collection': 'getCollection',
    'fetch:comments:collection:byAction': 'fetchCommentsByAction',
  },
  fetchCommentsByAction(actionId) {
    const url = `/api/actions/${ actionId }/comments`;

    return this.fetchCollection({ url });
  },
});

export default new Entity();
