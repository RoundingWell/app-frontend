import { contains, each, isArray, isBoolean, isObject, isString } from 'underscore';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import i18n from 'js/i18n';

import './interaction-details.scss';

const intl = i18n.patients.patient.interactions;
const eventLabels = {
  InteractionCreated: intl.eventCreated,
  InteractionScheduled: intl.eventScheduled,
  InteractionCompleted: intl.eventCompleted,
  InteractionUpdated: intl.eventUpdated,
  InteractionCommentAdded: intl.eventCommentAdded,
  InteractionDeleted: intl.eventDeleted,
};

function getLabel(key) {
  const labels = {
    note: intl.note,
    message: intl.message,
    clinician_name: intl.clinician,
    made_contact: intl.contactMade,
    occurred_at: intl.occurredAt,
    expected_at: intl.expectedAt,
    admitted_at: intl.admitted,
    discharged_at: intl.discharged,
    admit_reason: intl.reason,
    discharge_disposition: intl.dischargeDisposition,
    discharge_location: intl.dischargeLocation,
  };
  const label = key.replace(/_/g, ' ');
  return labels[key] || label.charAt(0).toUpperCase() + label.slice(1);
}

function isInternalField(key) {
  return contains(['id', 'event', 'source', 'recorded_at', 'reference', 'context'], key) || key.startsWith('_') || key.endsWith('_id');
}

function formatValue(key, value) {
  if (isBoolean(value)) return value ? intl.yes : intl.no;
  if (key.endsWith('_at') && dayjs(value).isValid()) return dayjs(value).format('MMM D, YYYY, h:mm A');
  return value;
}

function addFields(fields, key, value, prefix) {
  if (isInternalField(key) || contains([null, undefined, ''], value)) return;

  const label = prefix + getLabel(key);
  if (isObject(value) && !isArray(value)) {
    fields.push(...getFields(value, `${ label }: `));
    return;
  }
  if (isArray(value)) {
    each(value, (item, index) => {
      if (isObject(item)) fields.push(...getFields(item, `${ label } ${ index + 1 }: `));
      else fields.push({ label, value: String(item) });
    });
    return;
  }

  fields.push({ label, value: formatValue(key, value) });
}

function getFields(attributes, prefix = '') {
  const fields = [];
  each(attributes, (value, key) => addFields(fields, key, value, prefix));
  return fields;
}

const InteractionEventView = View.extend({
  tagName: 'li',
  className: 'interaction-details__event',
  template: hbs`
    <div class="interaction-details__heading"><strong>{{ title }}</strong><time datetime="{{ recordedAt }}">{{ date }}</time></div>
    {{#if editor}}<p class="interaction-details__editor">{{ editor }}</p>{{/if}}
    {{#if isSnapshot}}<p class="interaction-details__caption">{{ @intl.patients.patient.interactions.metadataSnapshot }}</p>{{/if}}
    <dl class="interaction-details__fields">{{#each fields}}<dt>{{ label }}</dt><dd>{{ value }}</dd>{{/each}}</dl>
  `,
  templateContext() {
    const type = this.model.get('event')?.type;
    const editor = this.model.getEditor();
    const name = editor?.get('name');
    const recordedAt = this.model.get('recorded_at');
    return {
      title: eventLabels[type] || intl.eventOther,
      editor: isString(name) ? name : '',
      recordedAt,
      date: dayjs(recordedAt).format('MMM D, YYYY, h:mm A'),
      isSnapshot: type === 'InteractionUpdated',
      fields: getFields(this.model.attributes),
    };
  },
});

const EmptyView = View.extend({
  className: 'interaction-details__message',
  template: hbs`{{ @intl.patients.patient.interactions.eventsEmpty }}`,
});

const InteractionEventsView = CollectionView.extend({
  tagName: 'ol',
  className: 'interaction-details',
  childView: InteractionEventView,
  emptyView: EmptyView,
  viewComparator: false,
});

const InteractionEventsLoadingView = View.extend({
  className: 'interaction-details__message',
  attributes: { role: 'status' },
  template: hbs`{{ @intl.patients.patient.interactions.eventsLoading }}`,
});

const InteractionEventsErrorView = View.extend({
  className: 'interaction-details__message modal__error',
  attributes: { role: 'alert' },
  template: hbs`{{ @intl.patients.patient.interactions.eventsError }}`,
});

export { InteractionEventsView, InteractionEventsLoadingView, InteractionEventsErrorView };
