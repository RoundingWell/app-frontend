import { createIntl, createIntlCache } from '@formatjs/intl';

import i18n from 'js/i18n';

const cache = createIntlCache();

export default function message(name, values) {
  const text = i18n.patients.shared.messaging.composer[name];
  return createIntl({ locale: i18n.locales || 'en-US', defaultLocale: 'en-US', messages: {} }, cache)
    .formatMessage({ id: text, defaultMessage: text }, values, { ignoreTag: true });
}
