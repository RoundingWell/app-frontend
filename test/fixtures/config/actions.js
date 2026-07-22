import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import _ from 'underscore';
import customParseFormatPlugin from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormatPlugin);

const timeFormat = 'HH:mm:ss';

const start = dayjs('07:00:00', timeFormat);

const times = _.times(96, function(n) {
  return { time: start.add(15 * n, 'minutes').format(timeFormat) };
});

times.unshift({ time: null });

export default () => {
  const created = faker.date.between({
    from: dayjs().subtract(1, 'week').format(),
    to: dayjs().format(),
  });

  const due = dayjs(faker.date.between({
    from: dayjs().subtract(1, 'week').format(),
    to: dayjs().add(1, 'week').format(),
  }));

  return {
    id: faker.string.uuid({ version: 7 }),
    name: `${ faker.company.buzzVerb() } ${ faker.company.catchPhraseNoun() }`,
    details: faker.lorem.sentences(),
    due_date: due.format('YYYY-MM-DD'),
    due_time: (faker.helpers.arrayElement(times)).time,
    duration: faker.number.int({
      min: 0,
      max: 99,
    }),
    sequence: faker.number.int(100),
    created_at: created,
    options: {},
    outreach: 'disabled',
    sharing: 'disabled',
    updated_at: faker.date.between({
      from: created,
      to: dayjs().format(),
    }),
  };
};
