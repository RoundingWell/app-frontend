import Backbone from 'backbone';
import { View, CollectionView } from 'marionette';
import hbs from 'handlebars-inline-precompile';
import dayjs from 'dayjs';

import Tooltip from 'js/components/tooltip';
import Picklist from 'js/components/picklist';
import './date-filter.scss';

import { RELATIVE_DATE_RANGES } from 'js/static';

const relativeRanges = new Backbone.Collection(RELATIVE_DATE_RANGES);

const TypeView = View.extend({
  tagName: 'button',
  className: 'button-filter button__group flex-grow',
  template: hbs`{{formatMessage (intlGet "patients.shared.components.dateFilterComponent.dateTypes") type=id }}`,
  onRender() {
    this.$el.toggleClass('button--blue', this.getOption('selected') === this.model.id);
  },
  triggers: {
    'click': 'click',
  },
});

const FilterTypeView = CollectionView.extend({
  modelEvents: {
    'change:dateType': 'render',
  },
  className: 'flex',
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

const DateTemplate = hbs`{{formatDateTime selectedDate "MM/DD/YYYY"}}{{far "angle-down"}}`;

const MonthTemplate = hbs`{{formatDateTime selectedMonth "MMM YYYY"}}{{far "angle-down"}}`;

const WeekTemplate = hbs`{{formatDateTime selectedWeek "MM/DD/YYYY"}} - {{formatDateTime selectedEndWeek "MM/DD/YYYY"}}{{far "angle-down"}}`;

const RelativeTemplate = hbs`{{formatMessage (intlGet "patients.shared.components.dateFilterComponent.relativeDate") relativeTo=relativeDate }}{{far "angle-down"}}`;

const DefaultTemplate = hbs`{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.defaultTemplate.thisMonth }}{{far "angle-down"}}`;

const ControllerView = View.extend({
  template: hbs`
    {{#unless hidePrevNextButtons}}
      <button class="button-secondary--compact u-margin--r-8 js-prev">{{far "angle-left"}}</button>{{~ remove_whitespace ~}}
    {{/unless}}
    <button class="button-filter js-date">
      {{far "calendar-days"}}{{~ remove_whitespace ~}}
      {{formatMessage (intlGet "patients.shared.components.dateFilterComponent.dateTypes") type=dateType }}{{~ remove_whitespace ~}}:
      <span data-date-picker-label-region></span>
    </button>{{~ remove_whitespace ~}}
    {{#unless hidePrevNextButtons}}
      <button class="button-secondary--compact u-margin--l-8 js-next">{{far "angle-right"}}</button>
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

    if (this.model.get('relativeDate') === 'alltime') return;

    this.getTooltips();
  },
  templateContext() {
    return {
      hidePrevNextButtons: this.model.get('relativeDate') === 'alltime',
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
    <button class="datepicker__button js-today">{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.actionView.today }}</button>{{~ remove_whitespace ~}}
    <button class="datepicker__button js-current-week">{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.actionView.week }}</button>{{~ remove_whitespace ~}}
    <button class="datepicker__button js-current-month">{{ @intl.patients.shared.components.dateFilterComponent.dateFilterViews.actionView.month }}</button>
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
