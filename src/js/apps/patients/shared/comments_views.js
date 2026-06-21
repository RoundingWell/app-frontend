import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View } from 'marionette';

import 'scss/modules/comments.scss';

import intl from 'js/i18n';
import trim from 'js/utils/formatting/trim';

import InputWatcherBehavior from 'js/behaviors/input-watcher';

const PostCommentView = View.extend({
  className: 'comment__actions',
  template: hbs`
    <button class="button--green js-post" {{#if isDisabled}}disabled{{/if}}>
      {{#if isNew}}
        {{ @intl.patients.shared.commentsViews.postCommentView.postBtn }}
      {{else}}
        {{ @intl.patients.shared.commentsViews.postCommentView.saveBtn }}
      {{/if}}
    </button>
    {{#unless shouldHideCancel}}<button class="button--text u-margin--r-4 js-cancel">{{ @intl.patients.shared.commentsViews.postCommentView.cancelBtn }}</button>{{/unless}}
    {{#unless isNew}}<button class="button--text u-float--left comment__delete js-delete"><span class="u-margin--r-4">{{far "trash-can"}}</span>{{ @intl.patients.shared.commentsViews.postCommentView.deleteBtn }}</button>{{/unless}}
  `,
  templateContext() {
    const shouldHideCancel = this.getOption('shouldHideCancel');
    const isDisabled = !this.model.isValid() || !this.model.hasChanged('message');
    const isNew = this.model.isNew();

    return {
      shouldHideCancel,
      isDisabled,
      isNew,
    };
  },
  triggers: {
    'click .js-cancel': 'cancel',
    'click .js-post': 'post',
    'click .js-delete': 'delete',
  },

});

const CommentFormView = View.extend({
  behaviors: [InputWatcherBehavior],
  modelEvents: {
    'change:message': 'showPostView',
  },
  ui: {
    input: '.js-input',
    spacer: '.js-spacer',
  },
  template: hbs`
    <div class="flex comment__form">
      <span class="comment__author-label">{{ initials }}</span>
      <div class="flex-grow pos--relative">
        <textarea class="input-secondary textarea-flex__input js-input" placeholder="{{ @intl.patients.shared.commentsViews.commentFormView.placeholder }}">{{ message }}</textarea>
        <div class="textarea-flex__container input-secondary comment__input js-spacer">{{ message }}</div>
      </div>
    </div>
    <div data-post-region></div>
  `,
  regions: {
    post: '[data-post-region]',
  },
  childViewTriggers: {
    'post': 'post:comment',
    'cancel': 'cancel:comment',
    'delete': 'confirm:delete',
  },
  templateContext() {
    const clinician = this.model.getClinician();
    return {
      initials: clinician.getInitials(),
    };
  },
  onRender() {
    this.showPostView();
  },
  onWatchChange(text) {
    this.ui.input.val(text);
    this.ui.spacer.text(text || ' ');

    this.model.set('message', trim(text));
  },
  showPostView() {
    const shouldHideCancel = this.model.isNew() && !this.model.get('message');

    this.showChildView('post', new PostCommentView({
      model: this.model,
      shouldHideCancel,
    }));
  },
  onConfirmDelete() {
    const modal = Radio.request('modal', 'show:small', {
      bodyText: intl.patients.shared.commentsViews.commentFormView.deleteModal.bodyText,
      headingText: intl.patients.shared.commentsViews.commentFormView.deleteModal.headingText,
      submitText: intl.patients.shared.commentsViews.commentFormView.deleteModal.submitText,
      buttonClass: 'button--red',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('delete:comment', this.model);
      },
    });
  },
});

export {
  CommentFormView,
};
