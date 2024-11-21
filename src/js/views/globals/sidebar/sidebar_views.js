import { View } from 'marionette';

import 'scss/modules/sidebar.scss';

import { animSidebar } from 'js/anim';

import SidebarTemplate from './sidebar.hbs';

const LayoutView = View.extend({
  template: SidebarTemplate,
  className: 'sidebar flex-region',
  regions: {
    heading: '[data-heading-region]',
    menu: '[data-menu-region]',
    content: '[data-content-region]',
    footer: '[data-footer-region]',
  },
  triggers: {
    'click .js-close': 'close',
  },
  onAttach() {
    animSidebar(this.el);
  },
});

export {
  LayoutView,
};
