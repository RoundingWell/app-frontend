import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/sidebar.scss';
import 'scss/domain/action-state.scss';
import './patient-readonly.scss';

const ReadOnlyStateView = View.extend({
  tagName: 'span',
  className() {
    if (this.getOption('isCompact')) return 'patient-readonly--compact patient-readonly__status js-no-click';
    return 'patient-readonly w-100 js-no-click';
  },
  template: hbs`<span class="action--{{ stateOptions.color }}">{{fa stateOptions.iconType stateOptions.icon}}{{#unless isCompact}}<span class="u-margin--l-8">{{ stateName }}</span>{{/unless}}</span>{{~ remove_whitespace ~}}`,
  templateContext() {
    const state = this.model.getState();
    const isCompact = this.getOption('isCompact');

    return {
      isCompact,
      stateOptions: state.get('options'),
      stateName: state.get('name'),
    };
  },
});

const ReadOnlyOwnerView = View.extend({
  tagName: 'span',
  className() {
    if (this.getOption('isCompact')) return 'patient-readonly--compact patient-readonly__owner js-no-click';
    return 'patient-readonly patient-readonly__owner w-100 js-no-click';
  },
  template: hbs`{{far "circle-user" classes="u-margin--r-8"}}<span>{{ owner }}</span>`,
  templateContext() {
    const owner = this.model.getOwner();
    return {
      owner: owner.get(owner.type === 'teams' ? 'abbr' : 'name'),
    };
  },
});

const ReadOnlyDueDateView = View.extend({
  tagName: 'span',
  className: 'patient-readonly--compact js-no-click',
  template: hbs`
    <span{{#if isOverdue}} class="is-overdue"{{/if}}>
      {{far "calendar-days"}}{{#if due_date}}<span class="u-margin--l-8">{{formatDateTime due_date "SHORT" inputFormat="YYYY-MM-DD"}}</span>{{/if}}
    </span>
  `,
  templateContext() {
    return {
      isOverdue: this.model.isOverdue(),
    };
  },
});

const ReadOnlyDueTimeView = View.extend({
  tagName: 'span',
  className: 'patient-readonly--compact patient-readonly__time js-no-click',
  template: hbs`{{far "clock"}}{{#if due_time}}<span class="u-margin--l-8">{{formatDateTime due_time "LT" inputFormat="HH:mm:ss"}}</span>{{/if}}`,
});

const ReadOnlyDueDateTimeView = View.extend({
  template: hbs`
    <span class="patient-readonly{{#if isOverdue}} is-overdue{{/if}}">
      {{far "calendar-days"}}{{#if due_date}}<span class="u-margin--l-8">{{formatDateTime due_date "SHORT" inputFormat="YYYY-MM-DD"}}</span>{{/if}}
    </span>
    <span class="patient-readonly patient-readonly__time {{#if isOverdue}} is-overdue{{/if}}">
      {{far "clock"}}{{#if due_time}}<span class="u-margin--l-8">{{formatDateTime due_time "LT" inputFormat="HH:mm:ss"}}</span>{{/if}}
    </span>
  `,
  templateContext() {
    return {
      isOverdue: this.model.isOverdue(),
    };
  },
});

const ReadOnlyDurationView = View.extend({
  tagName: 'span',
  className: 'patient-readonly w-100',
  template: hbs`{{far "stopwatch"}}
    {{#if duration}}
      <span class="u-margin--l-8">{{formatMessage (intlGet "patients.shared.readOnlyViews.readOnlyDurationView.mins") min=duration}}</span>
    {{ else }}
      <span class="u-margin--l-8">{{ @intl.patients.shared.readOnlyViews.readOnlyDurationView.noDuration }}</span>
    {{/if}}
  `,
});

export {
  ReadOnlyStateView,
  ReadOnlyOwnerView,
  ReadOnlyDueDateView,
  ReadOnlyDueTimeView,
  ReadOnlyDueDateTimeView,
  ReadOnlyDurationView,
};
