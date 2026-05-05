import { createIntl, createIntlCache } from '@formatjs/intl';

const cache = createIntlCache();

function registerWith(Handlebars) {
  const { SafeString, Utils: { escapeExpression }, createFrame } = Handlebars;

  function intl(options) {
    if (!options.fn) {
      throw new Error('{{#intl}} must be invoked as a block helper');
    }

    const data = createFrame(options.data);
    data.intl = { ...data.intl, ...options.hash };

    return options.fn(this, { data });
  }

  function formatHTMLMessage(...args) {
    const options = args[args.length - 1];

    Object.keys(options.hash).forEach(key => {
      const value = options.hash[key];

      if (typeof value === 'string') {
        options.hash[key] = escapeExpression(value);
      }
    });

    return new SafeString(String(formatMessage(...args)));
  }

  Handlebars.registerHelper({
    intl,
    intlGet,
    formatDate,
    formatMessage,
    formatHTMLMessage,
  });
}

function intlGet(path, options) {
  let obj = options.data && options.data.intl;

  path.split('.').forEach(pathPart => {
    obj = obj && obj[pathPart];

    if (obj === undefined) {
      throw new ReferenceError(`Could not find Intl object: ${ path }`);
    }
  });

  return obj;
}

function formatDate(date, format, options) {
  assertIsDateInput(date, 'A date or timestamp must be provided to {{formatDate}}');

  const value = new Date(date);

  assertIsDate(value, 'A date or timestamp must be provided to {{formatDate}}');

  if (!options) {
    options = format;
    format = null;
  }

  return getIntl(options).formatDate(value, getFormatOptions('date', format, options));
}

function formatMessage(message, options) {
  if (!options) {
    options = message;
    message = null;
  }

  const hash = options.hash;

  if (message == null && hash.intlName) {
    message = intlGet(hash.intlName, options);
  }

  if (typeof message === 'function') {
    return message(hash);
  }

  if (typeof message !== 'string') {
    throw new ReferenceError('{{formatMessage}} must be provided a message or intlName');
  }

  return getIntl(options).formatMessage({
    id: message,
    defaultMessage: message,
  }, normalizeValues(hash), {
    ignoreTag: true,
  });
}

function getIntl(options) {
  const intlData = options.data.intl || {};
  const locale = intlData.locales || 'en-US';

  return createIntl({
    locale,
    defaultLocale: locale,
    formats: intlData.formats || {},
    messages: {},
  }, cache);
}

function getFormatOptions(type, format, options) {
  if (!format) return options.hash;

  return {
    ...intlGet(`formats.${ type }.${ format }`, options),
    ...options.hash,
  };
}

function normalizeValues(hash) {
  return Object.keys(hash).reduce((values, key) => {
    const value = hash[key];

    values[key] = value && typeof value.toHTML === 'function' ? value.toHTML() : value;

    return values;
  }, {});
}

function assertIsDateInput(date, errorMessage) {
  if (date == null) {
    throw new TypeError(errorMessage);
  }
}

function assertIsDate(date, errorMessage) {
  if (!isFinite(date)) {
    throw new TypeError(errorMessage);
  }
}

export {
  registerWith,
};
