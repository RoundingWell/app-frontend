import { times as _times } from 'underscore';
import dayjs from 'dayjs';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import './time-component.scss';

const i18n = intl.patients.shared.components.timeComponent;
const timeFormat = 'HH:mm:ss';

// Every 15 mins for 24 hours starting at 7am
const start = dayjs('07:00:00', timeFormat);

const times = _times(96, function(n) {
  return { id: start.add(15 * n, 'minutes').format(timeFormat) };
});

const NoTimeCompactTemplate = hbs`{{far "clock"}}`;

const TimeTemplate = hbs`{{far "clock"}}{{formatDateTime id "LT" inputFormat="HH:mm:ss" defaultHtml=defaultHtml}}`;

const CustomTimeTemplate = hbs`{{far "clock"}}{{formatDateTime time "LT" inputFormat="HH:mm:ss"}}`;

export default Droplist.extend({
  collection: new Backbone.Collection(times),
  align: 'right',
  popWidth: 192,
  isSelectlist: true,
  className: 'button button--compact time-component',
  onRender() {
    const hasSelectedTime = !!this.getState().get('selected');
    this.el.classList.toggle('is-overdue', hasSelectedTime && this.getOption('isOverdue'));
  },
  getTemplate() {
    const selected = this.getState().get('selected');
    const time = selected ? selected.id : null;

    if (!time && this.getOption('time')) {
      return CustomTimeTemplate;
    }

    if (!time && !this.getOption('showLabel')) {
      return NoTimeCompactTemplate;
    }

    return TimeTemplate;
  },
  templateContext() {
    return {
      time: this.getOption('time'),
      defaultHtml: `<span>${ i18n.defaultText }</span>`,
    };
  },
  picklistOptions: {
    canClear: true,
    clearText: i18n.clear,
    headingText: i18n.headingText,
    placeholderText: i18n.placeholderText,
    isSelectlist: true,
    itemTemplateContext() {
      return {
        text: dayjs(this.model.id, timeFormat).format('LT'),
      };
    },
  },
  initialize({ time }) {
    const selected = this.collection.get(time);

    this.getState().set({ selected });
  },
  onChangeSelected(selected) {
    const time = selected ? selected.id : null;

    this.triggerMethod('change:time', time);
  },
});
