import { bind, extend } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import intl from 'js/i18n';

import { animSidebar } from 'js/anim';

import PreloadRegion from 'js/regions/preload_region';

import Optionlist from 'js/components/optionlist';

import { FlowStateComponent, OwnerComponent } from 'js/views/patients/shared/flows_views';
import { ReadOnlyStateView, ReadOnlyOwnerView } from 'js/views/patients/shared/read-only_views';

import FlowSidebarTemplate from './flow-sidebar.hbs';

import './flow-sidebar.scss';

const i18n = intl.patients.sidebar.flow.flowSidebarViews;

const TimestampsView = View.extend({
  className: 'sidebar__footer flex',
  template: hbs`
    <div class="sidebar__footer-left"><h4 class="sidebar__label">{{ @intl.patients.sidebar.flow.flowSidebarViews.timestampsView.createdAt }}</h4><div>{{formatDateTime created_at "AT_TIME"}}</div></div>
    <div><h4 class="sidebar__label">{{ @intl.patients.sidebar.flow.flowSidebarViews.timestampsView.updatedAt }}</h4><div>{{formatDateTime updated_at "AT_TIME"}}</div></div>
  `,
});

const MenuView = View.extend({
  tagName: 'button',
  className: 'button--icon',
  template: hbs`{{far "ellipsis"}}`,
  triggers: {
    'click': 'click',
  },
});

const PermissionView = View.extend({
  className: 'flex u-margin--t-8',
  template: hbs`
    <h4 class="sidebar__label u-margin--t-8">{{ @intl.patients.sidebar.flow.flowSidebarViews.permissionView.label }}</h4>
    <div class="flex flex--grow action-sidebar__info">
      {{far "ban"}}<span class="u-margin--l-8">{{ @intl.patients.sidebar.flow.flowSidebarViews.permissionView.info }}</span>
    </div>
  `,
});

const LayoutView = View.extend({
  childViewTriggers: {
    'save': 'save',
    'cancel': 'cancel',
  },
  className: 'sidebar flex-region',
  template: FlowSidebarTemplate,
  regions: {
    menu: '[data-menu-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    permission: '[data-permission-region]',
    activity: {
      el: '[data-activity-region]',
      regionClass: PreloadRegion,
    },
    timestamps: '[data-timestamps-region]',
  },
  triggers: {
    'click .js-close': 'close',
  },
  templateContext() {
    return {
      canEdit: this.model.canEdit(),
    };
  },
  modelEvents: {
    'change:_state': 'showOwner',
    'change:_owner': 'showFlow',
    'change:updated_at': 'showTimestamps',
  },
  onAttach() {
    animSidebar(this.el);
  },
  onRender() {
    this.showFlow();
    this.showTimestamps();
  },
  showFlow() {
    this.canEdit = this.model.canEdit();
    this.canDelete = this.model.canDelete();

    this.showActions();
    this.showMenu();
  },
  showActions() {
    this.showState();
    this.showOwner();
    this.showPermission();
  },
  showMenu() {
    if (!this.canDelete) {
      this.getRegion('menu').empty();
      return;
    }

    const menuView = new MenuView();

    this.listenTo(menuView, 'click', this.onClickMenu);

    this.showChildView('menu', menuView);
  },
  onClickMenu(view) {
    const menuOptions = new Backbone.Collection([
      {
        onSelect: bind(this.triggerMethod, this, 'delete'),
      },
    ]);

    const optionlist = new Optionlist({
      ui: view.$el,
      uiView: this,
      headingText: i18n.layoutView.headingText,
      itemTemplate: hbs`{{far "trash-can" classes="sidebar__delete-icon"}}<span>{{ @intl.patients.sidebar.flow.flowSidebarViews.layoutView.delete }}</span>`,
      lists: [{ collection: menuOptions }],
      align: 'right',
      popWidth: 248,
    });

    optionlist.show();
  },
  showState() {
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    const stateComponent = new FlowStateComponent({
      flow: this.model,
      stateId: this.model.get('_state'),
    });

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model });
      this.showChildView('owner', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    const program = this.model.getProgram();
    const ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      state: { isDisabled },
    });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  showTimestamps() {
    this.showChildView('timestamps', new TimestampsView({ model: this.model }));
  },
  showPermission() {
    if (this.canEdit) {
      this.getRegion('permission').empty();
      return;
    }

    this.showChildView('permission', new PermissionView());
  },
});

function getDeleteModal(opts) {
  return extend({ buttonClass: 'button--red' }, i18n.deleteModal, opts);
}

export {
  getDeleteModal,
  LayoutView,
};
