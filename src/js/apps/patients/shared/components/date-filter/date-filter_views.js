import Backbone from 'backbone';
import { View, CollectionView } from 'marionette';
import hbs from 'handlebars-inline-precompile';
import dayjs from 'dayjs';

import 'scss/modules/buttons.scss';

import Tooltip from 'js/components/tooltip';
import Picklist from 'js/components/picklist';

import { RELATIVE_DATE_RANGES } from 'js/static';

import './date-filter.scss';

const relativeRanges = new Backbone.Collection(RELATIVE_DATE_RANGES);

const TypeView = View.extend({
  tagName: 'button',
  className: 'button date-filter__type flex-grow',
  attributes: {
    type: 'button',
  },
  template: hbs`{{formatMessage (intlGet "patients.shared.components.dateFilterComponent.dateTypes") type=id }}`,
  onRender() {
    const isSelected = this.getOption('selected') === this.model.id;
    this.$el.attr('aria-pressed', String(isSelected));
  },
  triggers: {
    'click': 'click',
  },
});

const FilterTypeView = CollectionView.extend({
  modelEvents: {
    'change:dateType': 'render',
  },
  className: 'date-filter__types',
  childView: TypeView,
  childViewTriggers: {
    'click': 'click',
  },
  onClick({ model }) {
    this.model.set('dateType', model.id);
  },
  childViewOptions() {
    return {
      selected: this.model.get('dateType'),
    };
  },
});

const DateTemplate = hbs`{{formatDateTime selectedDate "MM/DD/YYYY"}}`;

const MonthTemplate = hbs`{{formatDateTime selectedMonth "MMM YYYY"}}`;

const WeekTemplate = hbs`{{formatDateTime selectedWeek "MM/DD/YYYY"}} - {{formatDateTime selectedEndWeek "MM/DD/YYYY"}}`;

const RelativeTemplate = hbs`{{formatMessage (intlGet "patients.shared.components.dateFilterComponent.relativeDate") relativeTo=relativeDate }}`;

const DefaultTemplate = hbs`{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.defaultTemplate.thisMonth }}`;

const ControllerView = View.extend({
  className: 'date-filter__controls',
  template: hbs`
    <button class="button date-filter__date-button js-date" type="button">
      {{far "calendar-days"}}{{~ remove_whitespace ~}}
      {{formatMessage (intlGet "patients.shared.components.dateFilterComponent.dateTypes") type=dateType }}{{~ remove_whitespace ~}}:
      <span data-date-picker-label-region></span>
    </button>{{~ remove_whitespace ~}}
    {{#unless hidePrevNextButtons}}
      <span class="button-group button-group--joined date-filter__navigation">
        <button class="button button--compact date-filter__nav-button date-filter__nav-button--prev js-prev" type="button">{{far "angle-left"}}</button>{{~ remove_whitespace ~}}
        <button class="button button--compact date-filter__nav-button date-filter__nav-button--next js-next" type="button">{{far "angle-right"}}</button>
      </span>
    {{/unless}}
  `,
  regions: {
    datepicker: {
      el: '[data-date-picker-label-region]',
      replaceElement: true,
    },
  },
  ui: {
    next: '.js-next',
    prev: '.js-prev',
    date: '.js-date',
  },
  triggers: {
    'click @ui.prev': 'click:prev',
    'click @ui.next': 'click:next',
    'click @ui.date': 'click:date',
  },
  getLabelTemplate() {
    if (this.model.get('selectedDate')) return DateTemplate;
    if (this.model.get('selectedMonth')) return MonthTemplate;
    if (this.model.get('selectedWeek')) return WeekTemplate;
    if (this.model.get('relativeDate')) return RelativeTemplate;
    return DefaultTemplate;
  },
  onRender() {
    this.showChildView('datepicker', {
      tagName: 'span',
      model: this.model,
      template: this.getLabelTemplate(),
      templateContext() {
        if (!this.model.get('selectedWeek')) return {};
        return {
          selectedEndWeek: this.model.dayjs('selectedWeek').endOf('week'),
        };
      },
    });

    if (this.getOption('showPrevNextButtons') === false || this.model.get('relativeDate') === 'alltime') return;

    this.getTooltips();
  },
  templateContext() {
    return {
      hidePrevNextButtons: this.getOption('showPrevNextButtons') === false || this.model.get('relativeDate') === 'alltime',
    };
  },
  getTooltips() {
    const tooltipMessages = this.getTooltipMessages();

    new Tooltip({
      message: tooltipMessages.prevMessage,
      uiView: this,
      ui: this.ui.prev,
    });

    new Tooltip({
      message: tooltipMessages.nextMessage,
      uiView: this,
      ui: this.ui.next,
    });
  },
  getTooltipMessages() {
    if (this.model.get('selectedDate')) {
      return this._getTooltipDayMessage(this.model.dayjs('selectedDate'));
    }

    if (this.model.get('selectedMonth')) {
      return this._getTooltipMonthMessage(this.model.dayjs('selectedMonth'));
    }

    if (this.model.get('selectedWeek')) {
      return this._getTooltipWeekMessage(this.model.dayjs('selectedWeek'));
    }

    const relativeDate = this.model.get('relativeDate');
    const { prev, unit } = relativeRanges.get(relativeDate || 'thismonth').pick('prev', 'unit');
    const relativeMessages = {
      day: '_getTooltipDayMessage',
      month: '_getTooltipMonthMessage',
      week: '_getTooltipWeekMessage',
    };

    return this[relativeMessages[unit]].call(this, dayjs().subtract(prev, unit).startOf(unit));
  },
  _getTooltipDayMessage(ts) {
    return {
      prevMessage: dayjs(ts).subtract(1, 'day').format('MM/DD/YYYY'),
      nextMessage: dayjs(ts).add(1, 'day').format('MM/DD/YYYY'),
    };
  },
  _getTooltipMonthMessage(ts) {
    return {
      prevMessage: dayjs(ts).subtract(1, 'month').format('MMM YYYY'),
      nextMessage: dayjs(ts).add(1, 'month').format('MMM YYYY'),
    };
  },
  _getTooltipWeekMessage(ts) {
    const prevWeek = dayjs(ts).subtract(1, 'week');
    const nextWeek = dayjs(ts).add(1, 'week');
    return {
      prevMessage: `${ prevWeek.format('MM/DD/YYYY') } - ${ prevWeek.endOf('week').format('MM/DD/YYYY') }`,
      nextMessage: `${ nextWeek.format('MM/DD/YYYY') } - ${ nextWeek.endOf('week').format('MM/DD/YYYY') }`,
    };
  },
});

const ActionsView = View.extend({
  template: hbs`
    <button class="datepicker__button js-today" type="button">{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.actionView.today }}</button>{{~ remove_whitespace ~}}
    <button class="datepicker__button js-current-week" type="button">{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.actionView.week }}</button>{{~ remove_whitespace ~}}
    <button class="datepicker__button js-current-month" type="button">{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.actionView.month }}</button>
  `,
  triggers: {
    'click .js-current-week': 'click:currentWeek',
    'click .js-today': 'click:today',
    'click .js-current-month': 'click:currentMonth',
  },
});

const LayoutView = View.extend({
  className: 'date-filter',
  template: hbs`
    <div class="date-filter__label">{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.layoutView.dateLabel }}</div>
    <div class="date-filter__toggle" data-date-type-region></div>
    <div data-component-region></div>
  `,
  regions: {
    dateType: '[data-date-type-region]',
    component: '[data-component-region]',
  },
});

const DateRanges = Picklist.extend({
  className: 'date-filter__ranges',
  itemClassName: 'date-filter__range',
  itemTemplate: hbs`{{formatMessage (intlGet "patients.shared.components.dateFilterComponent.relativeDate") relativeTo=id}}{{#if isSelected}}{{fas "check"}}{{/if}}`,
  itemTemplateContext() {
    return {
      isSelected: this.model === this.state.get('selected'),
    };
  },
  viewEvents: {
    'picklist:item:select': 'onItemSelect',
  },
  onItemSelect({ model }) {
    this.triggerMethod('select', model.id);
  },
});

export {
  ActionsView,
  ControllerView,
  LayoutView,
  FilterTypeView,
  DateRanges,
};
