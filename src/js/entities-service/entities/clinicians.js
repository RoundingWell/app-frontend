import { first, last, extend, includes } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';
import { NIL as NIL_UUID, v5 as uuid } from 'uuid';
import { RWELL_NS } from 'js/static';

import trim from 'js/utils/formatting/trim';

const TYPE = 'clinicians';
const WRITABLE_ATTRIBUTES = [
  'name',
  'email',
  'credentials',
  'settings',
  'enabled',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  type: TYPE,
  urlRoot: '/api/clinicians',
  createId() {
    const email = this.get('email');

    /* istanbul ignore next: dev protection */
    if (!email) {
      throw new Error('Cannot create clinician without email');
    }

    return uuid(`clinician:${ String(email).toLowerCase() }`, RWELL_NS);
  },
  preinitialize() {
    this.on('change:_team', this.onChangeTeam);
  },
  /* eslint-disable complexity */
  /* istanbul ignore next: default options branch */
  validate(attrs, options = {}) {
    if (!trim(attrs.name)) return 'A clinician name is required';
    if (!trim(attrs.email)) return 'A clinician email address is required';
    if (!attrs._role) return 'A clinician role is required';

    if (options.isManualCreation) {
      if (!attrs._team) return 'A clinician team is required';
      if (!attrs._workspaces?.length) return 'A clinician workspace is required';
    }
  },
  onChangeTeam() {
    const previousTeam = Radio.request('entities', 'teams:model', this.previous('_team'));
    const team = this.getTeam();

    previousTeam && previousTeam.removeClinician(this);
    team && team.addClinician(this);
  },
  getWorkspaces() {
    return Radio.request('entities', 'workspaces:collection', this.get('_workspaces'));
  },
  addWorkspace(workspace) {
    const workspaces = this.getWorkspaces();
    workspaces.add(workspace);
    this.set('_workspaces', workspaces.getResources());
  },
  removeWorkspace(workspace) {
    const workspaces = this.getWorkspaces();
    workspaces.remove(workspace);
    this.set('_workspaces', workspaces.getResources());
  },
  setTeam(team) {
    this.set('_team', team.getResource());
  },
  getTeam() {
    return this.getRelationship('_team');
  },
  hasTeam() {
    const team = this.getTeam();

    return team && team.id !== NIL_UUID;
  },
  setRole(role) {
    this.set('_role', role.getResource());
  },
  getRole() {
    return this.getRelationship('_role');
  },
  can(prop) {
    const role = this.getRole();
    const permissions = role.get('permissions');
    return includes(permissions, prop);
  },
  saveRole(role) {
    return this.save({ _role: role.getResource() }, {
      relationships: {
        role: this.toRelation(role),
      },
    });
  },
  saveTeam(team) {
    return this.save({ _team: team.getResource() }, {
      relationships: {
        team: this.toRelation(team),
      },
    });
  },
  saveAll(attrs) {
    attrs = extend({}, this.attributes, attrs);

    const relationships = {
      'workspaces': this.toRelation(attrs._workspaces),
      'team': this.toRelation(attrs._team),
      'role': this.toRelation(attrs._role),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
  getInitials() {
    const names = String(this.get('name')).split(' ');

    if (names.length === 1) return first(names).charAt(0);

    return `${ first(names).charAt(0) }${ last(names).charAt(0) }`;
  },
  isEditable() {
    return !this.get('last_active_at');
  },
  isActive() {
    const hasTeam = this.hasTeam();
    const hasWorkspaces = !!this.getWorkspaces().length;
    const lastActive = this.get('last_active_at');

    return hasTeam && hasWorkspaces && lastActive;
  },
  isEnabled() {
    return this.get('enabled');
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/clinicians',
  model: Model,
  comparator: 'name',
  filterAssignable() {
    const clone = this.clone();

    const assignable = this.filter(clinician => {
      return clinician.isActive() && clinician.isEnabled() && clinician.can('work:own');
    });

    clone.reset(assignable);

    return clone;
  },
});

export {
  _Model,
  Model,
  Collection,
};
