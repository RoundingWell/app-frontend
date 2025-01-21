import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'events';

const _Model = BaseModel.extend({
  type: TYPE,

  getClinician() {
    return this.getRelationship('_clinician');
  },
  getRecipient() {
    return this.getRelationship('_recipient');
  },
  getEditor() {
    if (!this.get('_editor')) {
      return Radio.request('entities', 'clinicians:model', { name: 'RoundingWell' });
    }

    return this.getRelationship('_editor');
  },
  getTeam() {
    return this.getRelationship('_team');
  },
  getState() {
    return this.getRelationship('_state');
  },
  getProgram() {
    return this.getRelationship('_program');
  },
  getForm() {
    return this.getRelationship('_form');
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  model: Model,
});

export {
  _Model,
  Model,
  Collection,
};
