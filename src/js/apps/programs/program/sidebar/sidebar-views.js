import { View } from 'marionette';

import SidebarTemplate from './sidebar-layout.hbs';

import 'js/apps/programs/shared/program-items.scss';
import './program-sidebar.scss';

const SidebarView = View.extend({
  className: 'program-sidebar',
  template: SidebarTemplate,
  templateContext() {
    return {
      published: !!this.model.get('published_at'),
    };
  },
});

export {
  SidebarView,
};
