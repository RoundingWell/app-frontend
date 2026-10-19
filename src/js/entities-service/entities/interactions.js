import Store from 'backbone.store';
import dayjs from 'dayjs';
import { contains, findKey, has, omit } from 'underscore';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'interactions';

export function compareToBound(model, bound) {
  const timestamp = model.getTimestamp();
  return (timestamp ? Date.parse(timestamp) : Infinity) - (bound.timestamp ? Date.parse(bound.timestamp) : Infinity)
    || model.id.localeCompare(bound.id);
}

export function compareInteractions(left, right) {
  return compareToBound(left, { id: right.id, timestamp: right.getTimestamp() });
}

export const CHANNEL_GROUPS = {
  messages: ['sms', 'email', 'mail', 'fax', 'portal'],
  calls: ['voice', 'voicemail', 'video'],
  appointments: ['appointment'],
  visits: ['visit'],
};

const _Model = BaseModel.extend({
  type: TYPE,
  messages: {
    MetadataUpdated({ attributes }) {
      if (has(attributes, 'action_id') || has(attributes, 'flow_id')) {
        const relationships = {};
        if (has(attributes, 'action_id')) relationships._action = attributes.action_id ? { id: attributes.action_id, type: 'patient-actions' } : null;
        if (has(attributes, 'flow_id')) relationships._flow = attributes.flow_id ? { id: attributes.flow_id, type: 'flows' } : null;
        this.set({ ...relationships, updated_at: attributes.updated_at });
        return;
      }
      this.set({ metadata: omit(attributes, 'updated_at'), updated_at: attributes.updated_at });
    },
    InteractionScheduled({ attributes }) {
      this.set(attributes);
    },
    InteractionCompleted({ attributes }) {
      this.set(attributes);
    },
    InteractionCancelled({ attributes }) {
      this.set(attributes);
    },
    ResourceDeleted() {
      this.destroy({ isDeleted: true });
    },
  },
  getTimestamp() {
    return this.get('occurred_at') || this.get('expected_at');
  },
  hasDuration() {
    const duration = this.get('metadata')?.duration_minutes;
    const minutes = typeof duration === 'string' && duration.trim() ? Number(duration) : duration;
    return Number.isFinite(minutes) && minutes >= 0;
  },
  getAppointmentStatus() {
    const metadata = this.get('metadata');
    if (this.get('cancelled_at')) return 'cancelled';
    if (metadata?.status === 'cancelled') return;
    return metadata?.status;
  },
  getChannelGroup() {
    return findKey(CHANNEL_GROUPS, channels => contains(channels, this.get('channel')));
  },
  getLengthOfStay() {
    const metadata = this.get('metadata');
    if (!metadata?.admitted_at) return;
    const end = metadata.discharged_at ? dayjs(metadata.discharged_at) : dayjs();
    return end.startOf('day').diff(dayjs(metadata.admitted_at).startOf('day'), 'day');
  },
  getAction() {
    return this.getRelationship('_action');
  },
  getFlow() {
    return this.getRelationship('_flow');
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({ model: Model });

export { _Model, Model, Collection };
