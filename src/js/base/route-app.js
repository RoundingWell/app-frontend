import { RouteApplication } from '@mnjs/router';

import { addError } from 'js/datadog';

export default RouteApplication.extend({
  onCleanupError: addError,
});
