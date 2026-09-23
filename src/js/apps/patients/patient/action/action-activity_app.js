import Backbone from 'backbone';
import { Radio } from 'marionette';
import dayjs from 'dayjs';

import App from 'js/base/app';

import { ActionActivityLoadingView, ActionCommentFormView, LayoutView, ActivitiesView } from 'js/apps/patients/patient/action/action-activity_views';

export default App.extend({
  onBeforeStart() {
    this.showView(new ActionActivityLoadingView());
  },
  prepareStart({ action }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:actionEvents:collection', action.id, { signal }),
      Radio.request('entities', 'fetch:comments:collection:byAction', action.id, { signal }),
    ]);
  },
  onStart(app, { action, focusOnLoad }, [activity, comments]) {
    this.action = action;
    this.comments = comments;
    this.comments.add(action.getComments().filter(comment => comment.has('message')));
    this.activityCollection = new Backbone.Collection([...activity.models, ...comments.models]);

    this.listenTo(action, 'ws:add:comment', this.onWsAddComment);

    this.setView(new LayoutView());
    this.showActivity();
    this.showNewCommentForm();
    this.subscribe();
    this.showView();

    if (focusOnLoad) this.focus();
  },
  focus() {
    this.getRegion().focus();
  },
  onStop() {
    if (!this.comments) return;

    Radio.request('ws', 'unsubscribe', this.comments.models);
    this.stopListening(this.action);
  },
  onWsAddComment(model) {
    this.activityCollection.add(model);
    this.comments.add(model);

    Radio.request('ws', 'add', model);
  },
  showActivity() {
    const activitiesView = new ActivitiesView({
      collection: this.activityCollection,
      model: this.action,
    });
    this.listenTo(activitiesView, {
      'remove:comment': this.onRemoveComment,
    });

    this.getView().showChildView('activities', activitiesView);
  },
  showNewCommentForm() {
    const clinician = Radio.request('bootstrap', 'currentUser');

    const newCommentFormView = new ActionCommentFormView({
      model: Radio.request('entities', 'comments:model', {
        _action: this.action.getResource(),
        _clinician: clinician.getResource(),
      }),
    });

    this.listenTo(newCommentFormView, {
      'post:comment': this.onPostNewComment,
      'cancel:comment': this.showNewCommentForm,
    });

    this.getView().showChildView('comment', newCommentFormView);
  },
  onPostNewComment({ model }) {
    model.isSubmitting = true;
    model.trigger('change:isSubmitting');
    model.set({ created_at: dayjs.utc().format() });

    model.save()
      .then(() => {
        this.action.addComment(model);
        this.activityCollection.add(model);
        this.comments.add(model);

        Radio.request('ws', 'add', model);
        this.showNewCommentForm();
      })
      .catch(({ responseData }) => {
        model.isSubmitting = false;
        model.trigger('change:isSubmitting');
        Radio.request('alert', 'show:apiError', responseData);
      });
  },
  onRemoveComment(model) {
    model.destroy({ wait: true })
      .then(() => {
        this.action.removeComment(model);

        Radio.request('ws', 'unsubscribe', model);
      })
      .catch(({ responseData }) => {
        Radio.request('alert', 'show:apiError', responseData);
      });
  },
  subscribe() {
    Radio.request('ws', 'add', this.comments.models);
  },
});
