import Store from 'backbone.store';
import dayjs from 'dayjs';
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
    return Number.isFinite(duration) && duration >= 0;
  },
  getAppointmentStatus() {
    const metadata = this.get('metadata');
    if (metadata?.cancelled_at) return 'cancelled';
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
