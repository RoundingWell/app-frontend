import { faker } from '@faker-js/faker';

export default () => {
  return {
    id: faker.string.uuid({ version: 7 }),
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    birth_date: faker.date.past(40, '2010-01-01'),
  };
};
