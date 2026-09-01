import { get, omit } from 'underscore';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

import { alphaSort } from 'js/utils/sorting';

import { FORM_RESPONSE_STATUS } from 'js/static';

const TYPE = 'form-responses';
const WRITABLE_ATTRIBUTES = [
  'status',
  'response',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  type: TYPE,
  urlRoot: '/api/form-responses',
  saveAll() {
    const attrs = this.attributes;

    const relationships = {
      'form': this.toRelation(attrs._form),
      'patient': this.toRelation(attrs._patient),
      'action': this.toRelation(attrs._action),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
  getDraft() {
    if (this.get('status') !== FORM_RESPONSE_STATUS.DRAFT) return;

    return {
      updated: this.get('updated_at'),
      submission: this.getResponse(),
    };
  },
  getResponse() {
    return get(this.get('response'), 'data', {});
  },
  getFormData() {
    return omit(this.get('response'), 'data');
  },
  getEditor() {
    // editor can be a clinician or patient
    return this.getRelationship('_editor');
  },
  getEditorName() {
    const editor = this.getEditor();

    return editor.get('name') || `${ editor.get('first_name') } ${ editor.get('last_name') }`;
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/form-responses',
  model: Model,
  comparator(responseA, responseB) {
    return alphaSort('desc', responseA.get('updated_at'), responseB.get('updated_at'));
  },
  getFirstSubmission() {
    return this.find({ status: FORM_RESPONSE_STATUS.SUBMITTED });
  },
  filterSubmissions() {
    const clone = this.clone();
    const submissions = this.filter({ status: FORM_RESPONSE_STATUS.SUBMITTED });

    clone.reset(submissions);

    return clone;
  },
});

export {
  _Model,
  Model,
  Collection,
};
