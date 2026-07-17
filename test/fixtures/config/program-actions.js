import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    name: `${ faker.company.buzzVerb() } ${ faker.company.catchPhraseNoun() }`,
    details: faker.lorem.sentences(),
    days_until_due: faker.number.int({
      min: 0,
      max: 99,
    }),
    options: {},
    outreach: 'disabled',
    published_at: faker.helpers.arrayElement([faker.date.between({
      from: dayjs().subtract(2, 'week').format(),
      to: dayjs().subtract(1, 'week').format(),
    }), null]),
    archived_at: faker.helpers.arrayElement([faker.date.between({
      from: dayjs().subtract(2, 'week').format(),
      to: dayjs().subtract(1, 'week').format(),
    }), null]),
    behavior: faker.helpers.arrayElement(['standard', 'conditional', 'automated']),
    sequence: faker.number.int(100),
    created_at: faker.date.between({
      from: dayjs().subtract(2, 'week').format(),
      to: dayjs().subtract(1, 'week').format(),
    }),
    updated_at: faker.date.between({
      from: dayjs().subtract(1, 'week').format(),
      to: dayjs().format(),
    }),
  };
};
