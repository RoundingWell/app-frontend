import { faker } from '@faker-js/faker';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    direction: 'outbound',
    channel: 'sms',
    status: 'sent',
    body: faker.lorem.sentence(),
    phone: '+16155550100',
    failure_reason: null,
    created_at: '2026-09-24T10:00:00+00:00',
    updated_at: '2026-09-24T10:00:00+00:00',
    send_at: null,
    queued_at: '2026-09-24T10:00:00+00:00',
    sent_at: '2026-09-24T10:00:00+00:00',
    failed_at: null,
    sort_at: '2026-09-24T10:00:00+00:00',
  };
};
