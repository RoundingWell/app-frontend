import { isEmpty } from 'underscore';

import { getUrl } from 'js/base/fetch';
import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection } from './entities/interactions';

function getFilter(actionId, flowId, channels) {
  const filter = {};
  if (actionId) filter.action = actionId;
  if (flowId) filter.flow = flowId;
  if (channels) filter.channel = channels.join(',');
  return filter;
}

function getPage(at, before, after, limit) {
  const page = {};
  if (at) page.at = at;
  if (before) page.before = before;
  if (after) page.after = after;
  if (limit) page.limit = limit;
  return page;
}

function addParams(data, name, params) {
  if (!isEmpty(params)) data[name] = params;
}

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'interactions:model': 'getModel',
    'interactions:collection': 'getCollection',
    'fetch:interactions:collection:byPatient': 'fetchByPatient',
  },
  fetchByPatient({ patientId, actionId, flowId, channels, at, before, after, limit }, options = {}) {
    const { data: requestData, ...requestOptions } = options;
    const data = { ...requestData, include: 'action.flow,flow' };
    addParams(data, 'filter', getFilter(actionId, flowId, channels));
    addParams(data, 'page', getPage(at, before, after, limit));

    return this.fetchCollection({
      ...requestOptions,
      // Page and preview requests share an endpoint but have independent results.
      url: getUrl(`/api/patients/${ patientId }/interactions`, data),
    });
  },
});

export default new Entity();
