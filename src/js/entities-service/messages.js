import dayjs from 'dayjs';
import { contains, isEmpty, pick, reject } from 'underscore';

import { getUrl } from 'js/base/fetch';
import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection } from './entities/messages';

function getShown(collection) {
  return collection.reject(model => model.get('status') === 'drafted');
}

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'messages:model': 'getModel',
    'messages:collection': 'getCollection',
    'fetch:messages:window:initial': 'fetchInitialWindow',
    'fetch:messages:window:older': 'fetchOlderWindow',
    'fetch:messages:window:toDate': 'fetchWindowToDate',
  },
  fetchByPatient({ patientId, before, limit }, options) {
    const data = { include: 'action,author' };
    const page = pick({ before, limit }, Boolean);
    if (!isEmpty(page)) data.page = page;
    const url = getUrl(`/api/patients/${ patientId }/messages`, data);

    return this.fetchCollection({ ...options, url });
  },
  async fetchInitialWindow(query, options) {
    const collection = await this.fetchByPatient(query, options);

    return {
      models: getShown(collection).reverse(),
      oldest: collection.last(),
      hasOlder: collection.length === query.limit,
    };
  },
  async fetchOlderWindow(query, window, options) {
    const collection = await this.fetchByPatient({ ...query, before: window.oldest.id }, options);
    const older = reject(getShown(collection), model => contains(window.models, model));

    return {
      models: [...older.reverse(), ...window.models],
      oldest: collection.last() || window.oldest,
      hasOlder: collection.length === query.limit,
    };
  },
  async fetchWindowToDate(query, window, date, options) {
    while (window.hasOlder) {
      options.signal.throwIfAborted();
      const oldest = window.models[0];
      if (oldest && dayjs(oldest.get('sort_at')).format('YYYY-MM-DD') < date) break;
      window = await this.fetchOlderWindow(query, window, options);
    }

    return window;
  },
});

export default new Entity();
