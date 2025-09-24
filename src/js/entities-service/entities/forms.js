import { get } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'forms';

const _Model = BaseModel.extend({
  type: TYPE,
  urlRoot: '/api/forms',
  isReadOnly() {
    return get(this.get('options'), 'read_only');
  },
  isReport() {
    return get(this.get('options'), 'is_report');
  },
  isSubmitHidden() {
    return get(this.get('options'), 'submit_hidden');
  },
  getFormUrl() {
    // NOTE: /formapp/ is legacy formio
    return this.get('url') || `/formapp/index.html?_TEST_=${ _TEST_ }`;
  },
  getWidgets() {
    const formWidgets = get(this.get('options'), ['widgets', 'widgets']);

    return Radio.request('widgets', 'build', formWidgets);
  },
  getPrefillFormId() {
    const prefillFormId = get(this.get('options'), 'prefill_form_id');

    if (!prefillFormId) return this.id;

    return prefillFormId;
  },
  getPrefillActionTag() {
    return get(this.get('options'), 'prefill_action_tag');
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/forms',
  model: Model,
  comparator: 'name',
});

export {
  _Model,
  Model,
  Collection,
};
