import hbs from 'handlebars-inline-precompile';
import { CollectionView, View } from 'marionette';

import 'scss/modules/list-manager.scss';

import Droplist from 'js/components/droplist';

const WorkspacesItemView = View.extend({
  tagName: 'li',
  className() {
    if (this.getOption('isDisabled')) return 'list-manager__item is-disabled';

    return 'list-manager__item';
  },
  template: hbs`{{far "users"}}<span>{{name}}</span>{{#unless isDisabled}}<button class="button--icon list-manager__remove js-remove">{{far "trash-can"}}</button>{{/unless}}`,
  templateContext() {
    return {
      isDisabled: this.getOption('isDisabled'),
    };
  },
  triggers: {
    'click .js-remove': 'remove',
  },
});

const WorkspacesListView = CollectionView.extend({
  tagName: 'ul',
  childView: WorkspacesItemView,
  childViewOptions() {
    return {
      isDisabled: this.getOption('isDisabled'),
    };
  },
  childViewTriggers: {
    'remove': 'remove',
  },
  onRemove(child) {
    this.triggerMethod('remove:member', child.model);
  },
});

const WorkspacesDropList = Droplist.extend({
  initialize() {
    this.listenTo(this.collection, 'update', this.show);
  },
  popWidth() {
    return this.getView().$el.outerWidth();
  },
  viewOptions: {
    className: 'button-secondary list-manager__droplist',
    template: hbs`{{far "users"}}<span>{{ @intl.shared.components.workspacesManager.workspacesDroplist.addWorkspace }}</span>`,
  },
  picklistOptions: {
    attr: 'name',
  },
  onShow() {
    const isDisabled = this.getOption('isDisabled');

    this.setState({ isDisabled: isDisabled || this.collection.length === 0 });
  },
  onPicklistSelect({ model }) {
    this.triggerMethod('add:member', model);
    this.popRegion.empty();
  },
});

export default View.extend({
  className: 'list-manager__wrapper',
  template: hbs`
    <div data-workspaces-region></div>
    <div data-droplist-region></div>
  `,
  regions: {
    workspaces: '[data-workspaces-region]',
    droplist: '[data-droplist-region]',
  },
  initialize({ member, workspaces }) {
    this.member = member;
    this.memberWorkspaces = this.member.getWorkspaces();
    this.workspaces = workspaces;

    this.workspaces.remove(this.memberWorkspaces.models);
  },
  onRender() {
    this.showWorkspaces();
    this.showDroplist();
  },
  showWorkspaces() {
    const workspacesView = this.showChildView('workspaces', new WorkspacesListView({
      collection: this.memberWorkspaces,
      isDisabled: this.getOption('isDisabled'),
    }));

    this.listenTo(workspacesView, 'remove:member', this.removeMemberWorkspace);
  },
  showDroplist() {
    if (this.getOption('isDisabled')) return;

    const droplist = this.showChildView('droplist', new WorkspacesDropList({
      collection: this.workspaces,
      ...this.getOption('droplistOptions'),
    }));

    this.listenTo(droplist, 'add:member', this.addMemberWorkspace);
  },
  addMemberWorkspace(workspace) {
    this.memberWorkspaces.add(workspace);
    this.workspaces.remove(workspace);
    this.triggerMethod('add:member', this.member, workspace);
  },
  removeMemberWorkspace(workspace) {
    this.memberWorkspaces.remove(workspace);
    this.workspaces.add(workspace);
    this.triggerMethod('remove:member', this.member, workspace);
  },
});
