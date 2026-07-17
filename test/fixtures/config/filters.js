import { faker } from '@faker-js/faker';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    name: faker.lorem.word(),
    description: faker.lorem.sentence(),
    slug: faker.lorem.slug(),
    values: faker.helpers.arrayElements([
      { value: faker.lorem.word(), total: 0 },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
      { value: faker.lorem.word(), total: faker.number.int({ min: 0, max: 10 }) },
    ]),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
  };
};
