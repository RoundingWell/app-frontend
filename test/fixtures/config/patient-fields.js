import { faker } from '@faker-js/faker';

export default () => {
  return {
    id: faker.string.uuid(),
    name: faker.lorem.word(),
    value: faker.number.int({
      min: 0,
      max: 100000,
    }),
  };
};
