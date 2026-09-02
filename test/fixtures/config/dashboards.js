import { faker } from '@faker-js/faker';

export default () => {
  const id = faker.string.uuid({ version: 7 });

  return {
    id,
    name: faker.person.jobTitle(),
    description: faker.lorem.sentences(),
    provider: 'quicksight',
    embed_url: `https://us-west-2.quicksight.aws.amazon.com/embed/embed_id/dashboards/${ id }?identityprovider=quicksight`,
  };
};
