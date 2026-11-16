import i18n from 'js/i18n';
import { formatMessage } from 'js/i18n/intl';

export default function message(name, values = {}) {
  return formatMessage(i18n.patients.shared.messaging.composer[name], { hash: values, data: { intl: i18n } });
}
