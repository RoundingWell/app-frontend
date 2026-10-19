import dayjs from 'dayjs';
import { contains, flatten, isEmpty, uniq, values } from 'underscore';

import { getUrl } from 'js/base/fetch';
import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection, CHANNEL_GROUPS, compareToBound } from './entities/interactions';

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
    'fetch:interactions:model:byPatient': 'fetchModelByPatient',
    'fetch:interactions:models:forActivity': 'fetchForActivity',
    'fetch:interactions:window:initial': 'fetchInitialWindow',
    'fetch:interactions:window:adjacent': 'fetchAdjacentWindow',
    'fetch:interactions:window:toDate': 'fetchWindowToDate',
    'fetch:interactions:window:refresh': 'fetchRefreshWindow',
  },
  getChannelGroups() {
    return CHANNEL_GROUPS;
  },
  async fetchModelByPatient(query, options) {
    const collection = await this.fetchByPatient({ ...query, limit: 1 }, options);
    // A filtered-out cursor can return its next matching neighbor.
    return collection.get(query.at);
  },
  async fetchInitialWindow(query, { signal }) {
    const collection = await this.fetchByPatient(query, { signal });
    const models = collection.filter(model => model.getTimestamp());
    return {
      models: query.at ? models : models.reverse(),
      hasOlder: query.at ? !!models.length : models.length === query.limit,
      hasNewer: !!query.at && !!models.length,
    };
  },
  async fetchRefreshWindow(query, window, options) {
    if (query.channels && !query.channels.length) return { models: [], hasOlder: false, hasNewer: false };
    const first = window.models[0];
    const last = window.models[window.models.length - 1];
    if (!first) return this.fetchInitialWindow({ ...query, at: undefined }, options);
    const lower = { id: first.id, timestamp: first.getTimestamp() };
    const upper = { id: last.id, timestamp: last.getTimestamp() };
    let refreshed = await this.fetchInitialWindow({ ...query, at: undefined }, options);
    while (refreshed.hasOlder && compareToBound(refreshed.models[0], lower) > 0) {
      options.signal.throwIfAborted();
      refreshed = await this.fetchAdjacentWindow(query, refreshed, 'older', options);
    }
    return {
      models: refreshed.models.filter(model => (!window.hasOlder || compareToBound(model, lower) >= 0)
        && (!window.hasNewer || compareToBound(model, upper) <= 0)),
      hasOlder: window.hasOlder || refreshed.hasOlder,
      hasNewer: window.hasNewer,
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
