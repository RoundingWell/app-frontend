import BaseEntity from 'js/base/entity-service';
import fetcher, { handleJSON } from 'js/base/fetch';
import { _Model, Model, Collection } from './entities/dashboards';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'dashboards:model': 'getModel',
    'dashboards:collection': 'getCollection',
    'fetch:dashboards:model': 'fetchModel',
    'fetch:dashboards:collection': 'fetchCollection',
    'fetch:dashboards:guest-token': 'fetchGuestToken',
  },
  fetchGuestToken(dashboardId) {
    return fetcher(`/api/dashboards/${ dashboardId }/guest-token`, { method: 'POST' })
      .then(handleJSON)
      .then(response => response.data.attributes.token);
  },
});

export default new Entity();
