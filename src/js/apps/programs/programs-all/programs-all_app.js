import { Radio } from 'marionette';

import App from 'js/base/app';

import { isPublishedProgram } from 'js/apps/programs/report/report-data';

import { ListView, LayoutView } from './programs-all_views';

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
    const programs = collection.clone();
    programs.reset(collection.filter(isPublishedProgram));
    this.getView().showChildView('list', new ListView({ collection: programs }));
    this.getView().focusHeading();
  },
});
