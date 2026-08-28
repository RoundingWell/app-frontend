import { result } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';

import { PROGRAM_BEHAVIORS } from 'js/static';
import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import 'js/apps/programs/shared/program-action-state.scss';

const i18n = intl.programs.shared.components.behaviorComponent;

const ButtonCompactTemplate = hbs`<span class="program-action-state {{ className }}{{#if isDisabled}} program-action-state--disabled{{/if}}">{{far icon}}</span>`;

const BehaviorTemplate = hbs`<span class="program-action-state {{ className }}{{#if isDisabled}} program-action-state--disabled{{/if}}">{{far icon}}<span>{{ name }}</span></span>`;

const BehaviorStates = [
  {
    icon: 'circle-play',
    className: 'program-action-state--standard',
    name: i18n.standardText,
    behavior: PROGRAM_BEHAVIORS.STANDARD,
  },
  {
    icon: 'circle-pause',
    className: 'program-action-state--conditional',
    name: i18n.conditionalText,
    behavior: PROGRAM_BEHAVIORS.CONDITIONAL,
  },
  {
    icon: 'bolt',
    className: 'program-action-state--automated',
    name: i18n.automatedText,
    behavior: PROGRAM_BEHAVIORS.AUTOMATED,
  },
];

export default Droplist.extend({
  isCompact: false,
  initialize(options) {
    const { behavior } = options;
    this.mergeOptions(options, ['isConditionalAvailable']);

    this.collection = new Backbone.Collection(BehaviorStates);

    if (!result(this, 'isConditionalAvailable')) {
      const conditional = this.collection.find({ behavior: PROGRAM_BEHAVIORS.CONDITIONAL });
      this.collection.remove(conditional);
    }

    this.setSelected({ behavior });
  },
  isConditionalAvailable: true,
  onChangeSelected(selected) {
    const behavior = selected.get('behavior');
    this.triggerMethod('change:status', { behavior });
  },
  setSelected({ behavior }) {
    const selected = this.collection.find({ behavior });
    this.setState({ selected });
  },
  popWidth() {
    const isCompact = this.getOption('isCompact');

    return isCompact ? null : this.getView().$el.outerWidth();
  },
  viewOptions() {
    const isCompact = this.getOption('isCompact');

    return {
      className: isCompact ? 'button button--compact' : 'button button--secondary w-100',
      template: isCompact ? ButtonCompactTemplate : BehaviorTemplate,
      templateContext: {
        isDisabled: this.getState('isDisabled'),
      },
    };
  },
  picklistOptions() {
    return {
      headingText: i18n.headingText,
      itemTemplate: BehaviorTemplate,
    };
  },
});
