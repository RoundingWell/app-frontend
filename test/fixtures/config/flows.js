import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    name: `${ faker.company.buzzVerb() } ${ faker.company.catchPhraseNoun() }`,
    details: faker.lorem.sentences(),
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
