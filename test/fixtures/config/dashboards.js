import faker from '@roundingwellos/faker';

export default () => {
  const id = faker.datatype.uuid();

  return {
    id,
    name: faker.name.title(),
    description: faker.lorem.sentences(),
    embed_url: `https://us-west-2.quicksight.aws.amazon.com/embed/embed_id/dashboards/${ id }?identityprovider=quicksight`,
  };
};

