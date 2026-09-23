import { map, range } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

const i18n = intl.programs.shared.components.dueDayComponent;

const days = map(range(366), function(day) {
  return { id: day };
});

const SameDayTemplate = hbs`{{far "stopwatch"}}<span>{{ @intl.programs.shared.components.dueDayComponent.sameDay }}</span>`;

const NoDayCompactTemplate = hbs`{{far "stopwatch"}}`;

const NoDayTemplate = hbs`{{far "stopwatch"}}<span>{{ @intl.programs.shared.components.dueDayComponent.defaultText }}</span>`;

const DueDayTemplate = hbs`{{far "stopwatch"}}<span>{{formatMessage  (intlGet "programs.shared.components.dueDayComponent.days") day=id}}</span>`;

const itemTemplate = hbs`{{formatMessage  (intlGet "programs.shared.components.dueDayComponent.days") day=id}}`;

export default Droplist.extend({
  collection: new Backbone.Collection(days),
  isCompact: false,
  getTemplate() {
    const isCompact = this.getOption('isCompact');
    const selected = this.getState().get('selected');
    const day = selected ? selected.id : null;

    if (day === 0) {
      return SameDayTemplate;
    }

    if (!day && isCompact) {
      return NoDayCompactTemplate;
    }

    return day ? DueDayTemplate : NoDayTemplate;
  },
  className() {
    return this.getOption('isCompact') ?
      'button button--compact' :
      'button button--secondary w-100';
  },
  picklistOptions: {
    canClear: true,
    headingText: i18n.headingText,
    placeholderText: i18n.placeholderText,
    isSelectlist: true,
    itemTemplate,
  },
  initialize({ day }) {
    const selected = this.collection.get(day);

    this.getState().set({ selected });
  },
  popWidth() {
    const isCompact = this.getOption('isCompact');

    return isCompact ? null : this.el.offsetWidth;
  },
  onChangeSelected(selected) {
    const day = selected ? selected.id : null;

    this.triggerMethod('change:day', day);
  },
});
