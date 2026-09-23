import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';

import Picklist from 'js/components/picklist';

import './date-filter.scss';

const TypeView = View.extend({
  tagName: 'button',
  className: 'button date-filter__type flex-grow',
  attributes: {
    type: 'button',
  },
  template: hbs`{{formatMessage (intlGet "patients.shared.components.dateFilter.dateTypes") type=id }}`,
  onRender() {
    const isSelected = this.getOption('selected') === this.model.id;
    this.el.setAttribute('aria-pressed', String(isSelected));
  },
  triggers: {
    'click': 'click',
  },
});

const FilterTypeView = CollectionView.extend({
  stateEvents: {
    'change:dateType': 'render',
  },
  className: 'date-filter__types',
  childView: TypeView,
  childViewTriggers: {
    'click': 'click',
  },
  onClick({ model }) {
    this.getState().set('dateType', model.id);
  },
  childViewOptions() {
    return {
      selected: this.getState().get('dateType'),
    };
  },
});

const DateTemplate = hbs`{{formatDateTime selectedDate "MM/DD/YYYY"}}`;

const MonthTemplate = hbs`{{formatDateTime selectedMonth "MMM YYYY"}}`;

const WeekTemplate = hbs`{{formatDateTime selectedWeek "MM/DD/YYYY"}} - {{formatDateTime selectedEndWeek "MM/DD/YYYY"}}`;

const RelativeTemplate = hbs`{{formatMessage (intlGet "patients.shared.components.dateFilter.relativeDate") relativeTo=relativeDate }}`;

const DefaultTemplate = hbs`{{ @intl.patients.shared.components.dateFilter.dateFilterViews.dateLabelView.thisMonth }}`;

const DateLabelView = View.extend({
  tagName: 'span',
  serializeData() {
    return this.getState().toJSON();
  },
  getLabelTemplate() {
    const state = this.getState();

    if (state.get('selectedDate')) return DateTemplate;
    if (state.get('selectedMonth')) return MonthTemplate;
    if (state.get('selectedWeek')) return WeekTemplate;
    if (state.get('relativeDate')) return RelativeTemplate;
    return DefaultTemplate;
  },
  getTemplate() {
    return this.getLabelTemplate();
  },
  templateContext() {
    const state = this.getState();
    if (!state.get('selectedWeek')) return {};
    return {
      selectedEndWeek: state.dayjs('selectedWeek').endOf('week'),
    };
  },
});

const ActionsView = View.extend({
  template: hbs`
    <button class="datepicker__button js-today" type="button">{{ @intl.patients.shared.components.dateFilter.dateFilterViews.actionsView.today }}</button>{{~ remove_whitespace ~}}
    <button class="datepicker__button js-current-week" type="button">{{ @intl.patients.shared.components.dateFilter.dateFilterViews.actionsView.week }}</button>{{~ remove_whitespace ~}}
    <button class="datepicker__button js-current-month" type="button">{{ @intl.patients.shared.components.dateFilter.dateFilterViews.actionsView.month }}</button>
  `,
  triggers: {
    'click .js-current-week': 'click:currentWeek',
    'click .js-today': 'click:today',
    'click .js-current-month': 'click:currentMonth',
  },
});

const PickerView = View.extend({
  className: 'date-filter',
  template: hbs`
    <div class="date-filter__label">{{ @intl.patients.shared.components.dateFilter.dateLabel }}</div>
    <div class="date-filter__toggle" data-date-type-region></div>
    <div data-component-region></div>
  `,
  regions: {
    dateType: '[data-date-type-region]',
    component: '[data-component-region]',
  },
  childViewTriggers: {
    'select': 'select:range',
    'select:currentWeek': 'select:currentWeek',
    'select:today': 'select:today',
    'select:currentMonth': 'select:currentMonth',
    'change:selectedDate': 'change:selectedDate',
    'change:selectedMonth': 'change:selectedMonth',
  },
});

const DateRanges = Picklist.extend({
  className: 'date-filter__ranges',
  itemClassName: 'date-filter__range',
  itemTemplate: hbs`{{formatMessage (intlGet "patients.shared.components.dateFilter.relativeDate") relativeTo=id}}{{#if isSelected}}{{fas "check"}}{{/if}}`,
  itemTemplateContext() {
    return {
      isSelected: this.model === this.state.get('selected'),
    };
  },
  onPicklistItemSelect({ model }) {
    this.trigger('select', model.id);
  },
});

export {
  ActionsView,
  DateLabelView,
  PickerView,
  FilterTypeView,
  DateRanges,
};
