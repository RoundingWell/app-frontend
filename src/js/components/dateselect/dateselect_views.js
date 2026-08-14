import { View } from 'marionette';
import { compact, isNull } from 'underscore';
import dayjs from 'dayjs';

import DateSelectTemplate from './date-select.hbs';

const LayoutView = View.extend({
  className() {
    const state = this.getOption('state');

    return compact([
      'button-group',
      'button-group--joined',
      'date-select',
      this.getOption('rootClassName'),
      state.year && !state.selectedDate ? 'is-partial' : null,
    ]).join(' ');
  },
  template: DateSelectTemplate,
  regions: {
    selectRegion: {
      el: '[data-select-region]',
      replaceElement: true,
    },
  },
  ui: {
    cancel: '.js-cancel',
  },
  triggers: {
    'click @ui.cancel': 'click:cancel',
  },
  formatDate() {
    const state = this.getOption('state');

    if (state.selectedDate) {
      const date = dayjs(state.selectedDate);
      return date.format('MMM DD, YYYY');
    }

    if (!isNull(state.month)) {
      const date = dayjs().month(state.month).year(state.year);
      return date.format('MMM YYYY');
    }

    return state.year;
  },
  templateContext() {
    const state = this.getOption('state');

    return {
      date: this.formatDate(),
      hasError: state.hasError,
      isDisabled: state.isDisabled,
    };
  },
});

export {
  LayoutView,
};
