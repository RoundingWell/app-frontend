// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your other test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/guides/configuration#section-global
// ***********************************************************
import 'js/base/dayjs';

import './defaults';
import './commands';
import './form-drafts';
import '@cypress/code-coverage/support';
import './websockets';

import './api/actions';
import './api/clinicians';
import './api/comments';
import './api/dashboards';
import './api/events';
import './api/files';
import './api/filters';
import './api/flows';
import './api/forms';
import './api/form-definition';
import './api/form-fields';
import './api/form-responses';
import './api/patient-fields';
import './api/patients';
import './api/program-actions';
import './api/program-flows';
import './api/programs';
import './api/roles';
import './api/settings';
import './api/panels';
import './api/states';
import './api/tags';
import './api/teams';
import './api/widgets';
import './api/workspace-patients';
import './api/workspaces';
