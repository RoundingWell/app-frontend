import dayjs from 'dayjs';
import { contains, flatten, isEmpty, uniq, values } from 'underscore';

import { getUrl } from 'js/base/fetch';
import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection, CHANNEL_GROUPS } from './entities/interactions';

function getFilter(actionId, flowId, channels) {
  const filter = {};
  if (actionId) filter.action = actionId;
  if (flowId) filter.flow = flowId;
  if (channels) filter.channel = channels.join(',');
  return filter;
}

function getPage(at, before, after, limit) {
  const page = { limit };
  if (at) page.at = at;
  if (before) page.before = before;
  if (after) page.after = after;
  return page;
}

function addParams(data, name, params) {
  if (!isEmpty(params)) data[name] = params;
}

function getDateDirection(window, date) {
  const newest = window.models[window.models.length - 1];
  return window.hasNewer && newest && date > dayjs(newest.getTimestamp()).format('YYYY-MM-DD') ? 'newer' : 'older';
}

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'interactions:model': 'getModel',
    'interactions:channelGroups': 'getChannelGroups',
    'interactions:collection': 'getCollection',
    'fetch:interactions:collection:byPatient': 'fetchByPatient',
    'fetch:interactions:models:forActivity': 'fetchForActivity',
    'fetch:interactions:window:initial': 'fetchInitialWindow',
    'fetch:interactions:window:adjacent': 'fetchAdjacentWindow',
    'fetch:interactions:window:toDate': 'fetchWindowToDate',
  },
  getChannelGroups() {
    return CHANNEL_GROUPS;
  },
  async fetchInitialWindow(query, { signal }) {
    const collection = await this.fetchByPatient(query, { signal });
    return {
      models: query.at ? [...collection.models] : [...collection.models].reverse(),
      hasOlder: query.at ? !!collection.length : collection.length === query.limit,
      hasNewer: !!query.at && !!collection.length,
    };
  },
  async fetchAdjacentWindow(query, window, direction, { signal }) {
    const { models } = window;
    const newer = direction === 'newer';
    const availability = newer ? 'hasNewer' : 'hasOlder';
    const cursor = newer ? models[models.length - 1] : models[0];
    const collection = await this.fetchByPatient({
      patientId: query.patientId,
      channels: query.channels,
      limit: query.limit,
      [newer ? 'after' : 'before']: cursor.id,
    }, { signal });
    const adjacent = collection.filter(model => !contains(models, model));
    return {
      ...window,
      models: newer ? models.concat(adjacent) : [...adjacent].reverse().concat(models),
      [availability]: !!adjacent.length && collection.length === query.limit,
    };
  },
  async fetchWindowToDate(query, window, date, { signal }) {
    const direction = getDateDirection(window, date);
    const newer = direction === 'newer';
    const availability = newer ? 'hasNewer' : 'hasOlder';
    while (window[availability] && window.models.length) {
      signal.throwIfAborted();
      const edge = newer ? window.models[window.models.length - 1] : window.models[0];
      const edgeDate = dayjs(edge.getTimestamp()).format('YYYY-MM-DD');
      // Older pages must cross the day to include its first entries.
      if (newer ? edgeDate >= date : edgeDate < date) break;
      window = await this.fetchAdjacentWindow(query, window, direction, { signal });
    }
    return window;
  },
  async fetchForActivity({ patientId, actionId, flowId }, { signal }) {
    const channels = uniq(flatten(values(this.getChannelGroups())));
    const collection = await this.fetchByPatient({ patientId, actionId, flowId, channels, limit: 100 }, { signal });
    return collection.models;
  },
  fetchByPatient({ patientId, actionId, flowId, channels, at, before, after, limit }, options) {
    const data = { include: 'action.flow,flow' };
    addParams(data, 'filter', getFilter(actionId, flowId, channels));
    addParams(data, 'page', getPage(at, before, after, limit));

    return this.fetchCollection({
      ...options,
      // Page and preview requests share an endpoint but have independent results.
      url: getUrl(`/api/patients/${ patientId }/interactions`, data),
    });
  },
});

export default new Entity();
