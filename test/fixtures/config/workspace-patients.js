import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';

export default () => {
  const created = faker.date.between({
    from: dayjs().subtract(1, 'week').format(),
    to: dayjs().format(),
  });

  return {
    created_at: created,
    status: faker.helpers.arrayElement(['active', 'inactive', 'archived']),
    updated_at: faker.date.between({
      from: created,
      to: dayjs().format(),
    }),
  };
};
