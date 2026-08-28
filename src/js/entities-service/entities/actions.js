import Backbone from 'backbone';
import { contains, extend, keys, reduce, size } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import dayjs from 'dayjs';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';
import { ACTION_OUTREACH, ACTION_SHARING } from 'js/static';

import { addError } from 'js/datadog';

const TYPE = 'patient-actions';
const WRITABLE_ATTRIBUTES = [
  'name',
  'details',
  'due_date',
  'due_time',
  'duration',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  messages: {
    OwnerChanged({ owner, attributes }) {
      this.set({ _owner: owner, ...attributes });
    },
    StateChanged({ state, attributes }) {
      this.set({ _state: state, ...attributes });
    },
    ActionDueChanged({ attributes }) {
      this.set(attributes);
    },
    ActionDurationChanged({ attributes }) {
      this.set(attributes);
    },
    NameChanged({ attributes }) {
      this.set(attributes);
    },
    DetailsChanged({ attributes }) {
      this.set(attributes);
    },
    ActionCommentAdded({ comment, attributes }, { author }) {
      const commentModel = Radio.request('entities', 'comments:model', {
        id: comment.id,
        message: attributes.message,
        created_at: dayjs.utc().format(),
        edited_at: null,
        _clinician: { id: author, type: 'clinicians' },
        _action: this.getResource(),
      });

      this.addComment(commentModel);

      this.trigger('ws:add:comment', commentModel);
    },
    AttachmentAdded({ file, attributes }) {
      const attachmentModel = Radio.request('entities', 'files:model', {
        id: file.id,
        path: attributes.path,
        created_at: dayjs.utc().format(),
        _actions: [this.getResource()],
        _view: attributes.urls.view,
        _download: attributes.urls.download,
      });

      this.addFile(attachmentModel);

      this.trigger('ws:add:attachment', attachmentModel);
    },
    ResourceDeleted() {
      this.destroy({ isDeleted: true });
    },
  },
  urlRoot: '/api/actions',
  type: TYPE,
  getForm() {
    return this.getRelationship('_form');
  },
  hasForm() {
    return !!this.getForm();
  },
  getFormResponses() {
    return Radio.request('entities', 'formResponses:collection', this.get('_form_responses'));
  },
  getComments() {
    return Radio.request('entities', 'comments:collection', this.get('_comments'));
  },
  getFiles() {
    return Radio.request('entities', 'files:collection', this.get('_files'));
  },
  getPatient() {
    return this.getRelationship('_patient');
  },
  getOwner() {
    return this.getRelationship('_owner');
  },
  getAuthor() {
    return this.getRelationship('_author');
  },
  getFlow() {
    return this.getRelationship('_flow');
  },
  getState() {
    return this.getRelationship('_state');
  },
  getProgram() {
    return this.getRelationship('_program');
  },
  getProgramAction() {
    return this.getRelationship('_program_action');
  },
  getPreviousState() {
    return Radio.request('entities', 'states:model', this.previous('_state'));
  },
  isSameTeamAsUser() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const currentUsersTeam = currentUser.getTeam();

    const owner = this.getOwner();
    const ownersTeam = owner.type === 'teams' ? owner : owner.getTeam();

    return currentUsersTeam === ownersTeam;
  },
  isLocked() {
    return !!this.get('locked_at');
  },
  isDone() {
    const state = this.getState();
    return state.isDone();
  },
  isFlowDone() {
    const flow = this.getFlow();

    if (flow && !flow.isCached()) {
      addError(`Missing flow ${ flow.id } for action ${ this.id }`);
      return true;
    }

    return flow && flow.isDone();
  },
  isOverdue() {
    if (this.isDone()) return false;

    const date = this.get('due_date');
    const time = this.get('due_time');

    if (!time) return dayjs(date).isBefore(dayjs(), 'day');

    const dueDateTime = dayjs(`${ date } ${ time }`);

    return dueDateTime.isBefore(dayjs(), 'day') || dueDateTime.isBefore(dayjs(), 'minute');
  },
  hasTag(tagName) {
    return contains(this.get('tags'), tagName);
  },
  hasOutreach() {
    return this.get('outreach') === ACTION_OUTREACH.PATIENT;
  },
  hasSharing() {
    return this.get('sharing') !== ACTION_SHARING.DISABLED;
  },
  commentCount() {
    return this.getComments().length;
  },
  hasAllowedUploads() {
    const programAction = this.getProgramAction();

    return !!size(programAction.get('allowed_uploads'));
  },
  canEdit() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (currentUser.can('work:manage')) return true;

    if (currentUser.can('work:owned:manage') && this.getOwner() === currentUser) return true;

    if (currentUser.can('work:team:manage') && this.isSameTeamAsUser()) return true;

    return false;
  },
  canSubmit() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (currentUser.can('work:submit')) return true;

    if (currentUser.can('work:owned:submit') && this.getOwner() === currentUser) return true;

    if (currentUser.can('work:team:submit') && this.isSameTeamAsUser()) return true;

    return false;
  },
  canDelete() {
    // Delete UI unavailable if action is not editable
    if (!this.canEdit()) return false;

    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (currentUser.can('work:delete')) return true;

    if (currentUser.can('work:owned:delete') && this.getOwner() === currentUser) return true;

    if (currentUser.can('work:authored:delete') && this.getAuthor() === currentUser) return true;

    return false;
  },
  saveDueDate(date) {
    if (!date) {
      return this.save({ due_date: null, due_time: null });
    }
    return this.save({ due_date: date.format('YYYY-MM-DD') });
  },
  saveDueTime(time) {
    if (!time) {
      return this.save({ due_time: null });
    }
    return this.save({ due_time: time });
  },
  saveState(state) {
    const saveOpts = { _state: state.getResource() };

    return this.save(saveOpts, {
      relationships: {
        state: this.toRelation(state),
      },
    });
  },
  applyOwner(owner) {
    const flow = this.getFlow();

    if (!flow) return;

    return flow.saveOwner(owner);
  },
  saveOwner(owner) {
    return this.save({ _owner: owner.getResource() }, {
      relationships: {
        owner: this.toRelation(owner),
      },
    });
  },
  saveAll(attrs) {
    if (this.isNew()) attrs = extend({}, this.attributes, attrs);

    const relationships = {
      'patient': this.toRelation(attrs._patient),
      'flow': this.toRelation(attrs._flow),
      'form': this.toRelation(attrs._form),
      'owner': this.toRelation(attrs._owner),
      'state': this.toRelation(attrs._state),
      'program-action': this.toRelation(attrs._program_action),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
  addComment(comment) {
    const comments = this.getComments();
    comments.add(comment);

    this.set({ _comments: comments.getResources() });
  },
  removeComment(comment) {
    const comments = this.getComments();
    comments.remove(comment);

    this.set({ _comments: comments.getResources() });
  },
  addFile(file) {
    const files = this.getFiles();
    files.add(file);

    this.set({ _files: files.getResources() });
  },
  removeFile(file) {
    const files = this.getFiles();
    files.remove(file);

    this.set({ _files: files.getResources() });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/actions',
  model: Model,
  save(attrs) {
    return this.batchInvoke('saveAll', 20, attrs);
  },
  applyOwner(owner) {
    return this.batchInvoke('applyOwner', 20, owner);
  },
  groupByDate() {
    const groupedCollection = this.groupBy('due_date');

    return reduce(keys(groupedCollection), (collection, key) => {
      collection.add({
        date: key,
        actions: new Collection(groupedCollection[key]),
      });

      return collection;
    }, new Backbone.Collection([]));
  },
});

export {
  _Model,
  Model,
  Collection,
};
