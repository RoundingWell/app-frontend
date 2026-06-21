import { extend } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import { SidebarMixin } from 'js/services/sidebar';

import {
  SidebarView,
  TimestampsView,
  MenuView,
  getDeleteModal,
  headingText,
} from 'js/apps/patients/sidebar/flow/flow-sidebar_views';
import { ActivitiesView } from 'js/apps/patients/sidebar/flow/flow-sidebar-activity-views';

export default App.extend(extend({
  onBeforeStart({ flow }) {
    this.flow = flow;
    this.flow.trigger('editing', true);

    this.listenTo(this.flow, 'change:_owner', this.showMenu);

    this.showChildView('heading', headingText);
    this.showContent();
    this.showFooter();
    this.showMenu();
  },
  beforeStart() {
    return Radio.request('entities', 'fetch:flowEvents:collection', this.flow.id);
  },
  onStart(options, activity) {
    this.showContentView('activity', new ActivitiesView({ collection: activity, model: this.flow }));
  },
  onStop() {
    this.stopListening(this.flow);
    this.flow.trigger('editing', false);
  },
  showContent() {
    const sidebarView = new SidebarView({ model: this.flow });

    this.showChildView('content', sidebarView);
  },
  showMenu() {
    if (!this.flow.canDelete()) {
      this.getRegion('menu').empty();
      return;
    }

    const menuView = new MenuView();

    this.listenTo(menuView, 'delete', this.onDelete);

    this.showChildView('menu', menuView);
  },
  onDelete() {
    const modal = Radio.request('modal', 'show:small', getDeleteModal({
      onSubmit: () => {
        this.flow.destroy({ wait: true })
          .then(() => {
            Radio.trigger('event-router', 'patient:dashboard', this.flow.getPatient().id);
          })
          .catch(({ responseData }) => {
            Radio.request('alert', 'show:apiError', responseData);
          });
        modal.destroy();
      },
    }));
  },
  showFooter() {
    this.showChildView('footer', new TimestampsView({ model: this.flow }));
  },
}, SidebarMixin));
