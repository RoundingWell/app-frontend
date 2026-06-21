import { extend } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/sidebar.scss';

import intl from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import Optionlist from 'js/components/optionlist';

import { FlowStateComponent, OwnerComponent } from 'js/apps/patients/shared/flows_views';
import { ReadOnlyStateView, ReadOnlyOwnerView } from 'js/apps/patients/shared/read-only_views';

import FlowSidebarTemplate from './flow-sidebar.hbs';

import './flow-sidebar.scss';

const i18n = intl.patients.sidebar.flow.flowSidebarViews;
const headingText = i18n.headingText;

const TimestampsView = View.extend({
  modelEvents: {
    'change:updated_at': 'render',
  },
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
  onClick() {
    const menuOptions = new Backbone.Collection([{}]);

    const optionlist = new Optionlist({
      ui: this.$el,
      uiView: this,
      headingText: i18n.layoutView.headingText,
      itemTemplate: hbs`{{far "trash-can" classes="sidebar__delete-icon"}}<span>{{ @intl.patients.sidebar.flow.flowSidebarViews.layoutView.delete }}</span>`,
      lists: [{ collection: menuOptions }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', () => {
      this.triggerMethod('delete');
    });

    optionlist.show();
  },
});

const NameView = View.extend({
  className: 'patient-flow-sidebar__name',
  template: hbs`{{ name }}`,
});

const DetailsView = View.extend({
  className: 'sidebar__details',
  template: hbs`
    {{ details }}
    {{#unless details}}
      <span class="sidebar--no-results">{{ @intl.patients.sidebar.flow.flowSidebarTemplate.noDetails }}</span>
    {{/unless}}
  `,
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

const SidebarView = View.extend({
  template: FlowSidebarTemplate,
  regions: {
    name: '[data-name-region]',
    details: '[data-details-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    permission: '[data-permission-region]',
    activity: {
      el: '[data-activity-region]',
      regionClass: PreloadRegion,
    },
    timestamps: '[data-timestamps-region]',
  },
  templateContext() {
    return {
      canEdit: this.model.canEdit(),
    };
  },
  modelEvents: {
    'change:name': 'showName',
    'change:details': 'showDetails',
    'change:_state': 'showActions',
    'change:_owner': 'showActions',
  },
  onRender() {
    this.showName();
    this.showDetails();
    this.showActions();
    this.getRegion('activity').startPreloader();
  },
  showActions() {
    this.canEdit = this.model.canEdit();

    this.showState();
    this.showOwner();
    this.showPermission();
  },
  showName() {
    const nameView = new NameView({ model: this.model });
    this.showChildView('name', nameView);
  },
  showDetails() {
    const detailsView = new DetailsView({ model: this.model });
    this.showChildView('details', detailsView);
  },
  showState() {
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    const stateComponent = new FlowStateComponent({
      flow: this.model,
      stateId: this.model.getState().id,
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
  SidebarView,
  TimestampsView,
  headingText,
  MenuView,
};
