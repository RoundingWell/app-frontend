import { setupCypress, testScope } from '@mnjs/test/cypress';

import { stopMockServer } from './websockets';

setupCypress();

// Register first so the server closes after services, even if their cleanup fails.
/* eslint-disable-next-line mocha/no-top-level-hooks */
beforeEach(() => {
  testScope().defer(stopMockServer);
});
