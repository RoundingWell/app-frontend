import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/card-list.scss';

import intl from 'js/i18n';

import { PROGRAM_BEHAVIORS } from 'js/static';

import ActionItemTemplate from './action-item.hbs';

import './program-items.scss';

const i18n = intl.programs.shared.programViews;

const BEHAVIORS = {
  [PROGRAM_BEHAVIORS.STANDARD]: {
    icon: 'circle-play',
    label: i18n.behaviors.standard,
    modifier: 'standard',
  },
  [PROGRAM_BEHAVIORS.CONDITIONAL]: {
    icon: 'circle-pause',
    label: i18n.behaviors.conditional,
    modifier: 'conditional',
  },
  [PROGRAM_BEHAVIORS.AUTOMATED]: {
    icon: 'bolt',
    label: i18n.behaviors.automated,
    modifier: 'automated',
  },
};

function getItemContext(model) {
  return {
    behavior: BEHAVIORS[model.get('behavior')],
    ownerName: model.getOwner()?.get('name'),
  };
}

const EmptyView = View.extend({
  className: 'card-list__empty',
  template: hbs`<h2>{{ text }}</h2>`,
  templateContext() {
    return {
      text: this.getOption('text'),
    };
  },
});

const ActionItemView = View.extend({
  className: 'program-items__action',
  template: ActionItemTemplate,
  initialize() {
    const form = this.model.getForm();
    if (!form) return;

    this.listenTo(form, 'change:name', this.render);
  },
  templateContext() {
    return {
      ...getItemContext(this.model),
      hasDue: this.model.get('days_until_due') !== null,
      formName: this.model.getForm()?.get('name'),
    };
  },
});

const ActionListView = CollectionView.extend({
  className: 'card-list program-items__list',
  childView: ActionItemView,
  emptyView: EmptyView,
  emptyViewOptions() {
    return {
      text: this.getOption('emptyText'),
    };
  },
});

export {
  getItemContext,
  EmptyView,
  ActionListView,
};
