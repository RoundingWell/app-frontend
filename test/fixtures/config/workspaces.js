import { faker } from '@faker-js/faker';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    name: faker.company.buzzPhrase(),
    slug: faker.lorem.word(),
    settings: {},
  };
};
