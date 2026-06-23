import { extend, find, has, isString, keys, reduce } from 'underscore';
import dayjs from 'dayjs';
import Handlebars from 'handlebars/dist/cjs/handlebars';
import HandlebarsRuntime from 'handlebars/runtime';
import { setRenderer } from 'marionette';

import cliniciansEnUs from './en-US/clinicians.yml';
import dashboardsEnUs from './en-US/dashboards.yml';
import formsEnUs from './en-US/forms.yml';
import globalsEnUs from './en-US/globals.yml';
import patientsEnUs from './en-US/patients.yml';
import programsEnUs from './en-US/programs.yml';
import sharedEnUs from './en-US/shared.yml';
import { registerWith } from './intl';

const localeKey = 'careOptsFrontend';

const localEnUs = {
  locales: sharedEnUs.locales,
  [localeKey]: composeLocale([
    cliniciansEnUs[localeKey],
    dashboardsEnUs[localeKey],
    formsEnUs[localeKey],
    globalsEnUs[localeKey],
    patientsEnUs[localeKey],
    programsEnUs[localeKey],
    sharedEnUs[localeKey],
  ]),
};

const locales = {
  'en-US': localEnUs,
};

let currentLocale;
const intl = {};

function composeLocale(localeSections) {
  return reduce(localeSections, (locale, section) => {
    const duplicateKey = find(keys(section), key => has(locale, key));

    if (duplicateKey) {
      throw new TypeError(`Duplicate locale namespace: ${ duplicateKey }`);
    }

    return Object.assign(locale, section);
  }, {});
}

function setLocale(locale = 'en-US') {
  currentLocale = locale;

  // Mutate exported locale with en-US as fallback
  extend(intl, localEnUs[localeKey], locales[currentLocale][localeKey]);

  dayjs.locale(currentLocale);

  /* istanbul ignore if: dev use only */
  if (window.PHRASEAPP_CONFIG) {
    extend(intl, phraseAppMessages(intl));
  }
}

setLocale();

registerWith(Handlebars);
registerWith(HandlebarsRuntime);

setRenderer(renderTemplate);

// Allows for i18n data to be at {{ @intl.some.deep.key }}
function renderTemplate(template, data) {
  return template(data, {
    data: { intl },
  });
}

/* istanbul ignore next: dev use only */
function phraseAppMessages(nestedMessages, prefix = localeKey) {
  return reduce(keys(nestedMessages), (messages, key) => {
    if (key === 'locales') return messages;

    const value = nestedMessages[key];
    const prefixedKey = `${ prefix }.${ key }`;

    if (isString(value)) {
      messages[key] = `[[__phrase_${ prefixedKey }__]]`;

      return messages;
    }

    messages[key] = phraseAppMessages(value, prefixedKey);

    return messages;
  }, {});
}

export {
  composeLocale,
  renderTemplate,
  setLocale,
};

export default intl;
