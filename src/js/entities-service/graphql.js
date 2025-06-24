import BaseEntity from 'js/base/entity-service';
import fetcher, { handleJSON } from 'js/base/fetch';

const Entity = BaseEntity.extend({
  radioRequests: {
    'fetch:icd': 'fetchIcd',
  },
  fetchIcd({ term, prefixes, year = 2024 }) {
    const variables = { term, prefixes, year };
    const query = `query ($term: String!, $prefixes: [String!], $year: Int!) {
      icdCodes(term: $term, prefixes: $prefixes, year: $year) {
        code
        description
        hcc_v24
        hcc_v28
        isSpecific
        parent {
          code
          description
        }
        children {
          code
          description
        }
      }
    }`;

    return fetcher('/api/graphql', {
      header: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    })
      .then(handleJSON);
  },
});

export default new Entity();
