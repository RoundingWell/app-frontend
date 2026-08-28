import { extend, isEmpty } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import dayjs from 'dayjs';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

import { PATIENT_STATUS } from 'js/static';

const TYPE = 'patients';
const WRITABLE_ATTRIBUTES = [
  'first_name',
  'last_name',
  'birth_date',
  'sex',
  'source',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  type: TYPE,
  url() {
    if (this.isNew()) return '/api/patients';

    const currentWorkspace = Radio.request('workspace', 'current');
    return `/api/patients/${ this.id }?filter[workspace]=${ currentWorkspace.id }`;
  },

  validate({ first_name, last_name, birth_date, sex }) {
    const errors = {};

    if (!first_name || !last_name) errors.name = 'required';
    if (!sex) errors.sex = 'required';

    if (!birth_date) errors.birth_date = 'required';
    else if (dayjs(birth_date).isAfter()) errors.birth_date = 'invalidDate';

    if (!isEmpty(errors)) return errors;
  },
  getWorkspaces() {
    return Radio.request('entities', 'workspaces:collection', this.get('_workspaces'));
  },
  getFields() {
    return Radio.request('entities', 'patientFields:collection', this.get('_patient_fields'));
  },
  getField(name) {
    const fields = this.getFields();
    return fields.find({ name });
  },
  saveAll(attrs) {
    attrs = extend({}, this.attributes, attrs);

    const opts = { wait: true };

    if (this.isNew()) opts.type = 'PUT';

    return this.save(attrs, {}, opts);
  },
  canEdit() {
    return this.isNew() || this.get('source') === 'manual';
  },
  getSortName() {
    return (this.get('last_name') + this.get('first_name')).toLowerCase();
  },
  getWorkspacePatient() {
    return Radio.request('entities', 'get:workspacePatients:model', this.id);
  },
  toggleActiveStatus() {
    const workspacePatient = this.getWorkspacePatient();
    const currentStatus = workspacePatient.get('status');
    const newStatus = currentStatus !== PATIENT_STATUS.ACTIVE ? PATIENT_STATUS.ACTIVE : PATIENT_STATUS.INACTIVE;

    workspacePatient.saveAll({ status: newStatus });
  },
  setArchivedStatus() {
    const workspacePatient = Radio.request('entities', 'get:workspacePatients:model', this.id);

    workspacePatient.saveAll({ status: PATIENT_STATUS.ARCHIVED });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/patients',
  model: Model,
});

export {
  Model,
  _Model,
  Collection,
};
