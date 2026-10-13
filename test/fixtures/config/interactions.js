import { faker } from '@faker-js/faker';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    channel: 'sms',
    direction: 'outbound',
    reference: null,
    metadata: {},
    occurred_at: '2026-09-24T10:00:00+00:00',
    expected_at: null,
    created_at: '2026-09-24T10:00:00+00:00',
  };
};
