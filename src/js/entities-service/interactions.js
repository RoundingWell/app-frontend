import { isEmpty } from 'underscore';

import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection } from './entities/interactions';

function getFilter(actionId, channels) {
  const filter = {};
  if (actionId) filter.actionId = actionId;
  if (channels) filter.channel = channels.join(',');
  return filter;
}

function getPage(at, before, limit) {
  const page = {};
  if (at) page.at = at;
  if (before) page.before = before;
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
  fetchByPatient({ patientId, actionId, channels, at, before, limit }, options = {}) {
    const data = { ...options.data, include: 'action.flow,flow' };
    addParams(data, 'filter', getFilter(actionId, channels));
    addParams(data, 'page', getPage(at, before, limit));

    return this.fetchCollection({
      ...options,
      url: `/api/patients/${ patientId }/interactions`,
      data,
    });
  },
});

export default new Entity();
