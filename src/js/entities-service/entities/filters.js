import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'filters';

const FilterValues = BaseCollection.extend({
  comparator: function(model) {
    const total = model.get('total');
    const value = model.get('value');

    const group = total > 0 ? 0 : 1;

    return [group, value.toLowerCase()];
  },
});

const Model = BaseModel.extend({
  type: TYPE,
  url() {
    const params = new URLSearchParams();
    params.set('filter[worklist]', this.get('worklist'));
    return `/api/filters/${ this.get('slug') }/${ this.get('entityType') }?${ params.toString() }`;
  },
  getValues() {
    const values = new FilterValues(this.get('values'));
    return {
      withTotals: new FilterValues(values.reject({ total: 0 })),
      withoutTotals: new FilterValues(values.filter({ total: 0 })),
      values,
    };
  },
});

const Collection = BaseCollection.extend({
  model: Model,
  invokeFetch({ entityType, worklist }) {
    /* istanbul ignore next: Loading before the list requires a slow test */
    if (!worklist) return;

    return this.map(filter => {
      filter.set({ entityType, worklist });
      return filter.fetch();
    });
  },
});

export {
  Model,
  Collection,
};
