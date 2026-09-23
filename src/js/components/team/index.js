import { result } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { Radio } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import './team-component.scss';

const i18n = intl.shared.components.teamComponent;

const TeamItemTemplate = hbs`<div>{{matchText name query}} <span class="team-component__team">{{matchText abbr query}}</span></div>`;

export default Droplist.extend({
  TeamItemTemplate,
  isCompact: false,
  defaultText() {
    const isCompact = this.getOption('isCompact');

    return isCompact ? null : i18n.defaultText;
  },
  popWidth() {
    const isCompact = this.getOption('isCompact');

    return isCompact ? null : this.el.offsetWidth;
  },
  canClear: false,
  picklistOptions() {
    return {
      canClear: this.getOption('canClear'),
      itemTemplate: this.TeamItemTemplate,
      isSelectlist: true,
      headingText: i18n.headingText,
      placeholderText: i18n.placeholderText,
    };
  },
  className() {
    return this.getOption('isCompact') ?
      'button button--compact' :
      'button button--secondary w-100';
  },
  templateContext() {
    const icon = { type: 'far', icon: 'circle-user' };
    const defaultText = result(this, 'defaultText');

    if (this.getOption('isCompact')) {
      return {
        defaultText,
        attr: 'abbr',
        icon,
      };
    }

    return {
      defaultText,
      attr: 'name',
      icon,
    };
  },
  initialize() {
    this.collection = Radio.request('bootstrap', 'teams');

    this.getState().set({ selected: this.collection.get(this.getOption('team')) });
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:team', selected);
  },
});
