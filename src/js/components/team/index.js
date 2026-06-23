import { result } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';

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

    return isCompact ? null : this.getView().$el.outerWidth();
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
  viewOptions() {
    const icon = { type: 'far', icon: 'circle-user' };
    const defaultText = result(this, 'defaultText');

    if (this.getOption('isCompact')) {
      return {
        className: 'button-secondary--compact',
        templateContext: {
          defaultText,
          attr: 'abbr',
          icon,
        },
      };
    }

    return {
      className: 'button-secondary w-100',
      templateContext: {
        defaultText,
        attr: 'name',
        icon,
      },
    };
  },
  initialize({ team }) {
    this.collection = Radio.request('bootstrap', 'teams');

    this.setState({ selected: this.collection.get(team) });
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:team', selected);
  },
});
