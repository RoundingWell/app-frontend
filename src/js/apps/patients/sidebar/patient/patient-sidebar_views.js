import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import PreloadRegion from 'js/regions/preload_region';

import { WidgetCollectionView } from 'js/apps/patients/shared/widgets/widgets_views';

import 'js/apps/patients/shared/patient-sidebar.scss';
import './patient-sidebar.scss';

const sidebarOptions = {
  className: 'worklist-patient-sidebar flex-region',
};

const SidebarWidgetsView = WidgetCollectionView.extend({
  itemClassName: 'patient-sidebar__section',
});

const HeadingView = View.extend({
  className: 'worklist-patient-sidebar__user-icon',
  tagName: 'span',
  template: hbs`{{far "address-card"}}`,
});

const LayoutView = View.extend({
  template: hbs`
    <div class="worklist-patient-sidebar__patient-info js-patient">
      <div class="worklist-patient-sidebar__patient-name">{{ first_name }} {{ last_name }}</div>
      <div>
        <button class="button--link">View Patient Dashboard</button>
      </div>
    </div>
    <div class="worklist-patient-sidebar__widgets" data-widgets-region></div>
  `,
  regions: {
    widgets: {
      el: '[data-widgets-region]',
      regionClass: PreloadRegion,
    },
  },
  triggers: {
    'click .js-patient': 'click:patient',
  },
});

export {
  sidebarOptions,
  LayoutView,
  HeadingView,
  SidebarWidgetsView,
};
