import Backbone from 'backbone';
import { contains, extend, keys, reduce, size } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import dayjs from 'dayjs';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';
import JsonApiMixin from 'js/base/jsonapi-mixin';

import { ACTION_OUTREACH, ACTION_SHARING } from 'js/static';

const TYPE = 'patient-actions';
const { parseRelationship } = JsonApiMixin;

const _parseRelationship = function(relationship, key) {
  if (!relationship || key === 'owner') return relationship;

  return parseRelationship(relationship, key);
};

const _Model = BaseModel.extend({
  messages: {
    OwnerChanged({ owner, attributes }) {
      this.set({ _owner: owner, ...attributes });
    },
    StateChanged({ state, attributes }) {
      this.set({ _state: state.id, ...attributes });
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
    SharingUpdated({ attributes }) {
      this.set(attributes);
    },
    CommentAdded({ author, comment, attributes }) {
      const commentModel = Radio.request('entities', 'comments:model', {
        id: comment.id,
        message: attributes.message,
        created_at: dayjs.utc().format(),
        edited_at: null,
        _clinician: author,
      });

      this.trigger('add:comment', commentModel);
    },
    ResourceDeleted() {
      this.destroy({ isDeleted: true });
    },
  },
  urlRoot() {
    if (this.isNew()) {
      const flow = this.get('_flow');
      return flow ?
        `/api/flows/${ flow }/relationships/actions` :
        `/api/patients/${ this.get('_patient') }/relationships/actions`;
    }

    return '/api/actions';
  },
  type: TYPE,
  hasTag(tagName) {
    return contains(this.get('tags'), tagName);
  },
  getForm() {
    const formId = this.get('_form');
    if (!formId) return;
    return Radio.request('entities', 'forms:model', formId);
  },
  getFormResponses() {
    return Radio.request('entities', 'formResponses:collection', this.get('_form_responses'));
  },
  getPatient() {
    return Radio.request('entities', 'patients:model', this.get('_patient'));
  },
  getOwner() {
    const owner = this.get('_owner');
    const Owner = Store.get(owner.type);
    return new Owner({ id: owner.id });
  },
  isSameTeamAsUser() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const currentUsersTeam = currentUser.getTeam();

    const owner = this.getOwner();
    const ownersTeam = owner.type === 'teams' ? owner : owner.getTeam();

    return currentUsersTeam === ownersTeam;
  },
  getAuthor() {
    return Radio.request('entities', 'clinicians:model', this.get('_author'));
  },
  getFlow() {
    if (!this.get('_flow')) return;

    return Radio.request('entities', 'flows:model', this.get('_flow'));
  },
  getState() {
    return Radio.request('entities', 'states:model', this.get('_state'));
  },
  getProgram() {
    return Radio.request('entities', 'programs:model', this.get('_program'));
  },
  getPreviousState() {
    return Radio.request('entities', 'states:model', this.previous('_state'));
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
  hasOutreach() {
    return this.get('outreach') !== ACTION_OUTREACH.DISABLED;
  },
  hasSharing() {
    return this.get('sharing') !== ACTION_SHARING.DISABLED;
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
    const saveOpts = { _state: state.id };
    const sharing = this.get('sharing');

    if (state.isDone() && ![ACTION_SHARING.DISABLED, ACTION_SHARING.RESPONDED].includes(sharing)) {
      saveOpts.sharing = ACTION_SHARING.CANCELED;
    }

    return this.save(saveOpts, {
      relationships: {
        state: this.toRelation(state),
      },
    });
  },
  saveOwner(owner) {
    return this.save({ _owner: owner }, {
      relationships: {
        owner: this.toRelation(owner),
      },
    });
  },
  saveAll(attrs) {
    if (this.isNew()) attrs = extend({}, this.attributes, attrs);

    const relationships = {
      'flow': this.toRelation(attrs._flow, 'flows'),
      'form': this.toRelation(attrs._form, 'forms'),
      'owner': this.toRelation(attrs._owner),
      'state': this.toRelation(attrs._state, 'states'),
      'program-action': this.toRelation(attrs._program_action, 'program-actions'),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
  hasAttachments() {
    return !!size(this.get('_files'));
  },
  hasAllowedUploads() {
    if (!this.canEdit()) return false;

    const programAction = Radio.request('entities', 'programActions:model', this.get('_program_action'));

    return !!size(programAction.get('allowed_uploads'));
  },
  parseRelationship: _parseRelationship,
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/actions',
  model: Model,
  parseRelationship: _parseRelationship,
  save(attrs) {
    const saves = this.invoke('saveAll', attrs);

    return Promise.all(saves);
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
