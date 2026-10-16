import Store from 'backbone.store';
import { contains, findKey } from 'underscore';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'interactions';

export const CHANNEL_GROUPS = {
  messages: ['sms', 'email', 'mail', 'fax', 'portal'],
  calls: ['voice', 'voicemail', 'video'],
  appointments: ['appointment'],
  visits: ['visit'],
};

const _Model = BaseModel.extend({
  type: TYPE,
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
