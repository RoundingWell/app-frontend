import { extend, first, size } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

import trim from 'js/utils/formatting/trim';
import collectionOf from 'js/utils/formatting/collection-of';

import { ACTION_OUTREACH, STATE_STATUS, PROGRAM_BEHAVIORS } from 'js/static';

const TYPE = 'program-actions';

const _Model = BaseModel.extend({
  urlRoot: '/api/program-actions',
  type: TYPE,
  validate({ name }) {
    if (!trim(name)) return 'Action name required';
  },
  getTags() {
    return Radio.request('entities', 'tags:collection', collectionOf(this.get('tags'), 'text'));
  },
  addTag(tag) {
    const tags = this.getTags();
    tags.add(tag);
    return this.save({ tags: tags.map('text') });
  },
  removeTag(tag) {
    const tags = this.getTags();
    tags.remove(tag);
    return this.save({ tags: tags.map('text') });
  },
  getAction({ patientId, flowId }) {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();

    const defaultInitialState = first(states.filter({ status: STATE_STATUS.QUEUED }));

    return Radio.request('entities', 'actions:model', {
      name: this.get('name'),
      _flow: flowId,
      _patient: patientId,
      _state: defaultInitialState.id,
      _owner: this.get('_owner') || {
        id: currentUser.id,
        type: 'clinicians',
      },
      _program_action: this.id,
    });
  },
  enableAttachmentUploads() {
    this.save({ allowed_uploads: ['pdf'] });
  },
  disableAttachmentUploads() {
    this.save({ allowed_uploads: [] });
  },
  getOwner() {
    const owner = this.get('_owner');
    if (!owner) return;
    return Radio.request('entities', 'teams:model', owner.id);
  },
  saveOwner(owner) {
    owner = this.toRelation(owner);
    return this.save({ _owner: owner.data }, {
      relationships: { owner },
    });
  },
  getForm() {
    const formId = this.get('_form');
    if (!formId) return;
    return Radio.request('entities', 'forms:model', formId);
  },
  hasOutreach() {
    return this.get('outreach') !== ACTION_OUTREACH.DISABLED;
  },
  isVisibleToCurrentUser() {
    const visibleToTeamsList = this.get('_teams');
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const currentUserTeam = currentUser.getTeam();

    if (!size(visibleToTeamsList)) return true;

    return !!visibleToTeamsList.find(team => team.id === currentUserTeam.id);
  },
  saveForm(form) {
    form = this.toRelation(form);
    const saveData = { _form: form.data };
    if (!form.data) saveData.outreach = ACTION_OUTREACH.DISABLED;

    return this.save(saveData, {
      relationships: { form },
    });
  },
  saveAll(attrs) {
    attrs = extend({}, this.attributes, attrs);

    const relationships = {
      'owner': this.toRelation(attrs._owner, 'teams'),
      'form': this.toRelation(attrs._form, 'forms'),
      'program-flow': this.toRelation(attrs._program_flow, 'program-flows'),
      'program': this.toRelation(attrs._program, 'programs'),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  initialize(models, options = {}) {
    this.flowId = options.flowId;
    if (this.flowId) this.comparator = 'sequence';
  },
  url() {
    if (this.flowId) return `/api/program-flows/${ this.flowId }/actions`;
    return '/api/program-actions';
  },
  model: Model,
  updateSequences() {
    const data = this.map((flowAction, sequence) => {
      flowAction.set({ sequence });
      return flowAction.toJSONApi({ sequence });
    });

    return this.sync('patch', this, {
      url: this.url(),
      data: JSON.stringify({ data }),
    });
  },
  filterAddable() {
    const clone = this.clone();

    const addable = this.filter(action => {
      const isPublished = !!action.get('published_at');
      const isArchived = !!action.get('archived_at');
      const isAutomated = action.get('behavior') === PROGRAM_BEHAVIORS.AUTOMATED;
      const isVisible = action.isVisibleToCurrentUser();

      return isPublished && !isArchived && !isAutomated && isVisible;
    });

    clone.reset(addable);

    return clone;
  },
});

export {
  _Model,
  Model,
  Collection,
};
