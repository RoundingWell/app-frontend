import { createIntl } from '@formatjs/intl';

import i18n from 'js/i18n';

import messages from './messages.yml';

const intl = createIntl({ locale: i18n.locales || 'en-US', defaultLocale: 'en-US', messages });

export default function message(name, values) {
  return intl.formatMessage({ id: `patients.shared.messaging.composer.${ name }` }, values);
}
