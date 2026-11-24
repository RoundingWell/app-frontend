import { isEmpty, pick } from 'underscore';

import { getUrl } from 'js/base/fetch';
import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection } from './entities/messages';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'messages:model': 'getModel',
    'messages:collection': 'getCollection',
    'fetch:messages:collection:byAction': 'fetchByAction',
  },
  fetchByAction({ actionId, before, limit }, options) {
    const data = { include: 'author' };
    const page = pick({ before, limit }, Boolean);
    if (!isEmpty(page)) data.page = page;
    const url = getUrl(`/api/actions/${ actionId }/messages`, data);

    return this.fetchCollection({ ...options, url });
  },
});

export default new Entity();
