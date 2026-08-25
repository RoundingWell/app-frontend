import { map, invoke, compact } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

export default App.extend({
  channelName: 'widgets',
  radioRequests: {
    'build': 'buildWidgets',
    'find': 'findWidget',
  },
  initialize({ widgets }) {
    this.widgets = widgets;
  },
  findWidget(slug) {
    return this.widgets.find({ slug });
  },
  buildWidgets(widgetSlugs) {
    const widgets = map(widgetSlugs, this.findWidget, this);

    // NOTE: omit IDs so that widgets can be duplicated in a single list
    const deIDdWidgets = invoke(compact(widgets), 'omit', 'id');

    return Radio.request('entities', 'widgets:collection', deIDdWidgets);
  },
});
