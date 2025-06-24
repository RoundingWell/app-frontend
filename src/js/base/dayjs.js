import { isFunction } from 'underscore';
import dayjs from 'dayjs';
import utcPlugin from 'dayjs/plugin/utc';
import localizedFormatPlugin from 'dayjs/plugin/localizedFormat';
import weekdayPlugin from 'dayjs/plugin/weekday';
import customParseFormatPlugin from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(localizedFormatPlugin);
dayjs.extend(utcPlugin);
dayjs.extend(weekdayPlugin);
dayjs.extend(customParseFormatPlugin);
dayjs.extend(relativeTime);

const formats = {
  // Jan 15
  SHORT: 'MMM D',
  // Jan 15, 2019
  LONG: 'll',
  // 01/15/2019
  SLASHES: 'L',
  // 10:46 PM
  TIME: 'LT',
  // Jan 15, 2019 10:45 PM
  AT_TIME: 'lll',
  DATE(date) {
    /* istanbul ignore else */
    if (date.isSame(dayjs(), 'year')) {
      return date.format(formats.SHORT);
    }
    /* istanbul ignore next */
    return date.format(formats.LONG);
  },
  TIME_OR_DAY(date) {
    if (date.isSame(dayjs(), 'day')) {
      return date.format(formats.TIME);
    }

    return formats.DATE(date);
  },
  AGO_OR_TODAY(date) {
    if (date.isSame(dayjs(), 'day')) {
      return date.fromNow();
    }

    return formats.DATE(date);
  },
};

function formatDate(date, format) {
  const dateFormat = formats[format];

  // Custom dayjs format ie: 'MMM-YYYY'
  if (!dateFormat) return date.format(format);

  if (isFunction(dateFormat)) return dateFormat(date);

  return date.format(dateFormat);
}

export {
  formatDate,
};
