import { extend, isString, keys, reduce } from 'underscore';
import dayjs from 'dayjs';
import Handlebars from 'handlebars/dist/cjs/handlebars';
import HandlebarsRuntime from 'handlebars/runtime';
import { setRenderer } from 'marionette';

import localEnUs from './en-US.yml';
import { registerWith } from './intl';

const localeKey = 'careOptsFrontend';

const locales = {
  'en-US': localEnUs,
};

let currentLocale;
const intl = {};

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
  renderTemplate,
  setLocale,
};

export default intl;
