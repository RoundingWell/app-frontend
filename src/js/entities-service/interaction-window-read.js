import { filter, map } from 'underscore';

import { getInteractionAttributes } from './entities/interactions';

// A window may span several responses. Preserve events across all of them,
// before their parsed attributes reach the shared Store.
export default class InteractionWindowRead {
  constructor(date) {
    this.date = date;
    this.updates = new Map();
    this.deleted = new Set();
  }

  record({ category, resource, payload }) {
    if (category === 'ResourceDeleted') {
      this.deleted.add(resource.id);
      return;
    }
    const attributes = category === 'MetadataUpdated' ? getInteractionAttributes(payload.attributes) : payload.attributes;
    this.updates.set(resource.id, { ...this.updates.get(resource.id), ...attributes });
  }

  apply(attributes) {
    return map(filter(attributes, item => !this.deleted.has(item.id)), item => ({ ...item, ...this.updates.get(item.id) }));
  }

  filterModels(models) {
    return filter(models, model => !this.deleted.has(model.id));
  }
}
