import _ from 'underscore';
import { getResource } from 'helpers/json-api';

import fxTestSettings from 'fixtures/test/settings';

const TYPE = 'settings';

function buildSettings(fixture, settingKey, settingValue) {
  if (!settingKey) return fixture;

  const doesSettingExist = _.find(fixture, { id: settingKey });
  if (!doesSettingExist) throw new Error(`Setting with the ${ settingKey } key was not found in settings.json fixture.`);

  return _.map(fixture, item => {
    if (item.id === settingKey) {
      return { ...item, attributes: { value: settingValue } };
    }

    return item;
  });
}

Cypress.Commands.add('routeSettings', (settingKey, settingValue) => {
  const fixture = getResource(fxTestSettings, TYPE);

  const data = buildSettings(fixture, settingKey, settingValue);

  cy
    .intercept('GET', '/api/settings', {
      body: { data, included: [] },
    })
    .as('routeSettings');
});
