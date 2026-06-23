import { map, range } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import './owner-component.scss';

const i18n = intl.patients.shared.components.durationComponent;

const durations = map(range(99), function(duration) {
  return { id: duration + 1 };
});

const NoDurationTemplate = hbs`{{far "stopwatch"}}<span>{{ @intl.patients.shared.components.durationComponent.defaultText }}</span>`;

const DurationTemplate = hbs`{{far "stopwatch"}}<span>{{formatMessage (intlGet "patients.shared.components.durationComponent.mins") min=id}}</span>`;

const itemTemplate = hbs`{{formatMessage (intlGet "patients.shared.components.durationComponent.mins") min=id}}`;

export default Droplist.extend({
  collection: new Backbone.Collection(durations),
  getTemplate() {
    if (!this.getState('selected')) {
      return NoDurationTemplate;
    }
    return DurationTemplate;
  },
  viewOptions() {
    return {
      className: 'button-secondary w-100',
      template: this.getTemplate(),
    };
  },
  picklistOptions: {
    canClear: true,
    clearText: i18n.clear,
    headingText: i18n.headingText,
    placeholderText: i18n.placeholderText,
    isSelectlist: true,
    itemTemplate,
  },
  initialize({ duration }) {
    const selected = this.collection.get(duration);

    this.setState({ selected });
  },
  popWidth() {
    return this.getView().$el.outerWidth();
  },
  onChangeSelected(selected) {
    const duration = selected ? selected.id : 0;

    this.triggerMethod('change:duration', duration);
  },
});
