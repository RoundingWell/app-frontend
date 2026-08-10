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
  getProgramFlow() {
    return this.getRelationship('_program_flow');
  },
  getProgram() {
    return this.getRelationship('_program');
  },
  createAction({ patient, flow }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();

    const defaultInitialState = first(states.filter({ status: STATE_STATUS.QUEUED }));
    const actionPatient = patient || flow.getPatient();

    const attrs = {
      name: this.get('name'),
      _state: defaultInitialState.getResource(),
      _program_action: this.getResource(),
      _patient: actionPatient.getResource(),
    };
    if (flow) attrs._flow = flow.getResource();
    attrs._program = this.getProgram().getResource();

    return Radio.request('entities', 'actions:model', attrs);
  },
  enableAttachmentUploads() {
    this.save({ allowed_uploads: ['pdf'] });
  },
  disableAttachmentUploads() {
    this.save({ allowed_uploads: [] });
  },
  getOwner() {
    return this.getRelationship('_owner');
  },
  saveOwner(owner) {
    return this.save({ _owner: owner ? owner.getResource() : null }, {
      relationships: {
        owner: this.toRelation(owner),
      },
    });
  },
  getForm() {
    return this.getRelationship('_form');
  },
  hasOutreach() {
    return this.get('outreach') === ACTION_OUTREACH.PATIENT;
  },
  isVisibleToCurrentUser() {
    const visibleToTeamsList = this.get('_teams');
    const visibleToRolesList = this.get('_roles');
    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (size(visibleToTeamsList)) {
      const currentUserTeam = currentUser.getTeam();
      if (!visibleToTeamsList.find(team => team.id === currentUserTeam.id)) return false;
    }

    if (size(visibleToRolesList)) {
      const currentUserRole = currentUser.getRole();
      if (!visibleToRolesList.find(role => role.id === currentUserRole.id)) return false;
    }

    return true;
  },
  saveForm(form) {
    form = this.toRelation(form);
    const saveData = { _form: form.data };

    return this.save(saveData, {
      relationships: { form },
    });
  },
  saveAll(attrs) {
    attrs = extend({}, this.attributes, attrs);

    const relationships = {
      'owner': this.toRelation(attrs._owner),
      'form': this.toRelation(attrs._form),
      'program-flow': this.toRelation(attrs._program_flow),
      'program': this.toRelation(attrs._program),
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
