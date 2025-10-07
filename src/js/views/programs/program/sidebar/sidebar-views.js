import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';

import { View, Region } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Optionlist from 'js/components/optionlist';

import SidebarTemplate from './sidebar-layout.hbs';

import './program-sidebar.scss';

const i18n = intl.programs.program.sidebar.sidebarViews;

const SidebarView = View.extend({
  className: 'program-sidebar',
  template: SidebarTemplate,
  regionClass: Region.extend({ replaceElement: true }),
  triggers: {
    'click @ui.menu': 'click:menu',
  },
  ui: {
    menu: '.js-menu',
  },
  modelEvents: {
    'change': 'render',
  },
  templateContext() {
    return {
      published: !!this.model.get('published_at'),
    };
  },
  onClickMenu() {
    const menuOptions = new Backbone.Collection([
      {
        icon: 'pen-to-square',
        className: 'program-sidebar__edit',
        text: i18n.menuOptions.edit,
      },
    ]);

    const optionlist = new Optionlist({
      ui: this.ui.menu,
      uiView: this,
      headingText: i18n.menuOptions.headingText,
      itemTemplate: hbs`<span class={{ className }}>{{far icon}}{{ text }}</span>`,
      lists: [{ collection: menuOptions }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', () => {
      this.triggerMethod('edit');
    });

    optionlist.show();
  },
});

export {
  SidebarView,
};
