import { Radio } from 'marionette';

import App from 'js/base/app';

import { ListView, LayoutView } from 'js/apps/programs/programs-all/programs-all_views';

export default App.extend({
  onBeforeStart() {
    const view = this.setView(new LayoutView());

    view.render();
    view.getRegion('list').startPreloader({ variant: 'generic' });

    this.showView();
  },
  prepareStart(options, { signal }) {
    return Radio.request('entities', 'fetch:programs:collection', { signal });
  },
  onStart(app, options, collection) {
    this.getView().showChildView('list', new ListView({ collection }));
  },
});
