import { apiGuardContract } from './api-guard-contract';

context('E2E API guard', function() {
  apiGuardContract(() => {
    cy
      .routesForDefault()
      .visit();
  });
});
