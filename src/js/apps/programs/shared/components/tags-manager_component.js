import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { CollectionView, View } from 'marionette';

import 'scss/modules/list-manager.scss';

import trim from 'js/utils/formatting/trim';
import Droplist from 'js/components/droplist';

import intl from 'js/i18n';

import './tags-manager.scss';

const i18n = intl.programs.shared.components.tagsManagerComponent;

const TagsItemView = View.extend({
  tagName: 'li',
  className: 'list-manager__item tags-manager__item',
  template: hbs`{{far "tag"}}<span>{{text}}</span><button class="button--icon list-manager__remove js-remove">{{far "trash-can"}}</button>`,
  triggers: {
    'click .js-remove': 'remove',
  },
});

const TagsAddView = View.extend({
  tagName: 'button',
  className: 'picklist__item js-picklist-item tags-manager__add',
  modelEvents: {
    'change:query': 'render',
  },
  template: hbs`{{ @intl.programs.shared.components.tagsManagerComponent.tagsAddView.addLabel }} {{ query }}`,
  onBeforeRender() {
    this.shouldShow = !!this.model.get('query');
  },
  triggers: {
    'click': 'click:add',
  },
});

const TagsListView = CollectionView.extend({
  tagName: 'ul',
  childView: TagsItemView,
  childViewTriggers: {
    'remove': 'remove',
  },
  onRemove(child) {
    this.triggerMethod('remove:tag', child.model);
  },
});

const TagsDropList = Droplist.extend({
  initialize() {
    this.listenTo(this.collection, 'update', this.show);
  },
  popWidth() {
    return this.getView().$el.outerWidth();
  },
  viewOptions: {
    className: 'button-secondary list-manager__droplist',
    template: hbs`{{far "tag"}}<span>{{ @intl.programs.shared.components.tagsManagerComponent.tagsDroplist.addTag }}</span>`,
  },
  picklistOptions: {
    attr: 'text',
    headingText: i18n.tagsDroplist.picklistOptions.headingText,
    noResultsText: i18n.tagsDroplist.picklistOptions.noResultsText,
    isSelectlist: true,
    placeholderText: i18n.tagsDroplist.picklistOptions.placeholderText,
  },
  picklistEvents: {
    'watch:change'(query) {
      this.setState('query', query);
    },
    'picklist:click:add'() {
      const tagName = trim(this.getState('query'));
      const tag = Radio.request('entities', 'tags:model', { text: tagName });

      this.triggerMethod('add:tag', tag);
      this.popRegion.empty();
    },
  },
  onPicklistSelect({ model }) {
    this.triggerMethod('add:tag', model);
    this.popRegion.empty();
  },
});

export default View.extend({
  className: 'list-manager__wrapper',
  template: hbs`
    <div data-tags-region></div>
    <div data-droplist-region></div>
  `,
  regions: {
    tags: '[data-tags-region]',
    droplist: '[data-droplist-region]',
  },
  initialize({ tags, allTags }) {
    this.tags = tags.clone();
    this.allTags = allTags.clone();

    // Remove tags that are already selected
    this.allTags.remove(this.tags.models);
  },
  onRender() {
    this.showTags();
    this.showDroplist();
  },
  showTags() {
    const tagsView = this.showChildView('tags', new TagsListView({
      collection: this.tags,
    }));

    this.listenTo(tagsView, 'remove:tag', this.removeItemTag);
  },
  showDroplist() {
    const droplist = this.showChildView('droplist', new TagsDropList({
      collection: this.allTags,
      ...this.getOption('droplistOptions'),
    }));

    this.listenTo(droplist.popRegion, {
      'show'() {
        const picklist = droplist.popRegion.currentView;

        picklist.addChildView(new TagsAddView({
          model: droplist.getState(),
        }));
      },
    });

    this.listenTo(droplist, 'add:tag', this.addItemTag);
  },
  addItemTag(tag) {
    this.tags.add(tag);
    this.allTags.remove(tag);
    this.triggerMethod('add:tag', tag);
  },
  removeItemTag(tag) {
    this.tags.remove(tag);
    this.allTags.add(tag);
    this.triggerMethod('remove:tag', tag);
  },
});
