import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/forms.scss';
import 'scss/modules/textarea-flex.scss';

import intl from 'js/i18n';
import trim from 'js/utils/formatting/trim';

import InputWatcherBehavior from 'js/behaviors/input-watcher';

import './comments.scss';

const PostCommentView = View.extend({
  className: 'comment__actions',
  template: hbs`
    <button class="button button--positive comment__post js-post" type="button" {{#if isDisabled}}disabled{{/if}}>
      {{#if isNew}}
        {{ @intl.patients.shared.commentsViews.postCommentView.postBtn }}
      {{else}}
        {{ @intl.patients.shared.commentsViews.postCommentView.saveBtn }}
      {{/if}}
    </button>
    {{#unless shouldHideCancel}}<button class="button button--text u-margin--r-4 js-cancel" type="button">{{ @intl.patients.shared.commentsViews.postCommentView.cancelBtn }}</button>{{/unless}}
    {{#unless isNew}}<button class="button button--text u-float--left comment__delete js-delete" type="button"><span class="u-margin--r-4">{{far "trash-can"}}</span>{{ @intl.patients.shared.commentsViews.postCommentView.deleteBtn }}</button>{{/unless}}
  `,
  templateContext() {
    const shouldHideCancel = this.getOption('shouldHideCancel');
    const isNew = this.model.isNew();
    const hasMessageChange = isNew ?
      !!this.model.get('message') :
      this.model.hasChanged('message');
    const isDisabled = this.model.isSubmitting
      || !this.model.isValid()
      || !hasMessageChange;

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
    'change:isSubmitting': 'showPostView',
    'change:message': 'showPostView',
  },
  ui: {
    input: '.js-input',
    spacer: '.js-spacer',
  },
  template: hbs`
    <div class="flex comment__form">
      <span class="comment__author-label">{{ initials }}</span>
      <div class="flex-grow textarea-flex">
        <textarea class="form-input form-input--secondary textarea-flex__input js-input" placeholder="{{ @intl.patients.shared.commentsViews.commentFormView.placeholder }}">{{ message }}</textarea>
        <div class="textarea-flex__mirror form-input form-input--secondary comment__input js-spacer" aria-hidden="true">{{ message }}</div>
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
    this.showChildView('post', new PostCommentView({
      model: this.model,
      shouldHideCancel: false,
    }));
  },
  onConfirmDelete() {
    const modal = Radio.request('modal', 'show:small', {
      bodyText: intl.patients.shared.commentsViews.commentFormView.deleteModal.bodyText,
      headingText: intl.patients.shared.commentsViews.commentFormView.deleteModal.headingText,
      submitText: intl.patients.shared.commentsViews.commentFormView.deleteModal.submitText,
      buttonClass: 'button button--danger',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('delete:comment', this.model);
      },
    });
  },
});

export {
  PostCommentView,
  CommentFormView,
};
