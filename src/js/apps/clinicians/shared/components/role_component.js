import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import './role-component.scss';

const i18n = intl.clinicians.shared.components.roleComponent;

const ItemTemplate = hbs`<div><div>{{ label }}</div><div class="role-component__details">{{ description }}</div></div>`;

export default Droplist.extend({
  isCompact: false,
  popWidth() {
    const isCompact = this.getOption('isCompact');

    return isCompact ? null : this.getView().$el.outerWidth();
  },
  picklistOptions: {
    headingText: i18n.headingText,
    itemTemplate: ItemTemplate,
  },
  viewOptions() {
    const isCompact = this.getOption('isCompact');

    return {
      className: isCompact ? 'button-secondary' : 'button-secondary w-100',
      templateContext: {
        attr: 'label',
        defaultText: i18n.defaultText,
        icon: {
          type: 'far',
          icon: 'shield',
        },
      },
    };
  },
  initialize({ role }) {
    this.collection = Radio.request('bootstrap', 'roles');
    this.setState({ selected: role });
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:role', selected);
  },
});
