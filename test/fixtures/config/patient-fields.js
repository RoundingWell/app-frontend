import { faker } from '@faker-js/faker';
import { v5 as uuid } from 'uuid';

import { RWELL_NS } from '../../../src/js/static.js';

export default () => {
  const name = faker.lorem.word();
  const patientId = faker.string.uuid({ version: 7 });

  return {
    id: uuid(`patient:${ patientId }:field:${ name }`, RWELL_NS),
    name,
    value: faker.number.int({
      min: 0,
      max: 100000,
    }),
  };
};
