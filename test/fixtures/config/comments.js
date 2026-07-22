import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    message: faker.lorem.sentences(),
    edited_at: faker.helpers.arrayElement([faker.date.between({
      from: dayjs().subtract(1, 'week').format(),
      to: dayjs().format(),
    }), null]),
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
