import Backbone from 'backbone';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';

import App from 'js/base/app';

import { CommentFormView } from 'js/apps/patients/shared/comments_views';
import { LayoutView, ActivitiesView, TimestampsView } from 'js/apps/patients/patient/action/action-activity_views';

export default App.extend({
  onBeforeStart() {
    this.getRegion().startPreloader();
  },
  beforeStart({ action }) {
    return [
      Radio.request('entities', 'fetch:actionEvents:collection', action.id),
      Radio.request('entities', 'fetch:comments:collection:byAction', action.id),
    ];
  },
  onStart({ action }, activity, comments) {
    this.action = action;
    this.comments = comments;
    this.activityCollection = new Backbone.Collection([...activity.models, ...comments.models]);

    this.listenTo(action, 'ws:add:comment', this.onWsAddComment);

    this.showView(new LayoutView());
    this.showActivity();
    this.showNewCommentForm();
    this.subscribe();
  },
  onBeforeStop() {
    if (!this.comments) return;

    Radio.request('ws', 'unsubscribe', this.comments.models);
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
    const createdEvent = this.activityCollection.find({ event_type: 'ActionCreated' });

    this.listenTo(activitiesView, {
      'remove:comment': this.onRemoveComment,
    });

    this.showChildView('activities', activitiesView);
    this.showChildView('timestamps', new TimestampsView({ model: this.action, createdEvent }));
  },
  showNewCommentForm() {
    const clinician = Radio.request('bootstrap', 'currentUser');

    const newCommentFormView = new CommentFormView({
      model: Radio.request('entities', 'comments:model', {
        _action: this.action.getResource(),
        _clinician: clinician.getResource(),
      }),
    });

    this.listenTo(newCommentFormView, {
      'post:comment': this.onPostNewComment,
      'cancel:comment': this.showNewCommentForm,
    });

    this.showChildView('comment', newCommentFormView);
  },
  onPostNewComment({ model }) {
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
