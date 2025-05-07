import { faker } from '@faker-js/faker';

export default () => {
  return {
    id: faker.string.uuid(),
    name: faker.company.buzzPhrase(),
    slug: faker.lorem.word(),
    settings: {},
  };
};
