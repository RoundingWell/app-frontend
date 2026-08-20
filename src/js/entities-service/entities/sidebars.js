import Radio from 'backbone.radio';
import Store from 'backbone.store';
import { contains, filter } from 'underscore';

import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'sidebars';

const _Model = BaseModel.extend({
  type: TYPE,
  getWidgets() {
    const sidebarWidgetSlugs = Radio.request('widgets', 'sidebarWidgets').pluck('slug');
    const widgetSlugs = filter(this.get('widgets'), slug => contains(sidebarWidgetSlugs, slug));

    return Radio.request('widgets', 'build', widgetSlugs);
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/sidebars',
  model: Model,
  comparator: 'sequence',
});

export {
  _Model,
  Model,
  Collection,
};
