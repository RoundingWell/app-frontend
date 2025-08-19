import Handlebars from 'handlebars/dist/cjs/handlebars';
import HandlebarsRuntime from 'handlebars/runtime';
import dayjs from 'dayjs';
import parsePhoneNumber from 'libphonenumber-js/min';

import { formatDate } from './dayjs';
import matchText from 'js/utils/formatting/match-text';

const helpers = {
  matchText(text, query, { hash = {} }) {
    if (!query) return text;

    if (!hash.noEscape) text = Handlebars.escapeExpression(text);

    const options = {
      includeSubstrings: !!hash.includeSubstrings,
    };

    return new Handlebars.SafeString(matchText(text, query, options));
  },
  formatDateTime(date, format, { hash = {} }) {
    if (!date) return new Handlebars.SafeString(hash.defaultHtml || '');

    date = hash.utc ? dayjs.utc(date, hash.inputFormat).local() : dayjs(date, hash.inputFormat);

    date = formatDate(date, format);

    /* istanbul ignore if */
    if (hash.nowrap === false) return date;

    return new Handlebars.SafeString(`<span class="u-text--nowrap">${ date }</span>`);
  },
  formatPhoneNumber(value, { hash = {} }) {
    if (!value) return new Handlebars.SafeString(hash.defaultHtml || '');

    const phone = parsePhoneNumber(value, 'US');
    const formattedPhone = phone ? phone.formatNational() : '';

    return new Handlebars.SafeString(formattedPhone);
  },
  isValue(data, value) {
    return data === value;
  },
};

Handlebars.registerHelper(helpers);
HandlebarsRuntime.registerHelper(helpers);
