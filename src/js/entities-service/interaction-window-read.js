import { filter, has, map } from 'underscore';

import { _Model as InteractionModel, getInteractionAttributes } from './entities/interactions';

// A window may span several responses. Preserve events across all of them,
// before their parsed attributes reach the shared Store.
export default class InteractionWindowRead {
  constructor(date) {
    this.date = date;
    this.sequence = 0;
    this.updates = new Map();
    this.deleted = new Set();
  }

  record({ category, resource, payload }) {
    if (category === 'ResourceDeleted') {
      this.deleted.add(resource.id);
      return;
    }
    if (!has(InteractionModel.prototype.messages, category)) return;
    const attributes = category === 'MetadataUpdated' ? getInteractionAttributes(payload.attributes) : payload.attributes;
    const updates = this.updates.get(resource.id) || {};
    const sequence = ++this.sequence;
    for (const [key, value] of Object.entries(attributes)) updates[key] = { value, sequence };
    this.updates.set(resource.id, updates);
  }

  apply(attributes, sequence) {
    return map(filter(attributes, item => !this.deleted.has(item.id)), item => {
      const updated = { ...item };
      for (const [key, update] of Object.entries(this.updates.get(item.id) || {})) {
        if (update.sequence > sequence) updated[key] = update.value;
      }
      return updated;
    });
  }

  filterModels(models) {
    return filter(models, model => !this.deleted.has(model.id));
  }
}
