import { Radio } from 'marionette';

import App from 'js/base/app';

import ProgramSidebarApp from 'js/apps/programs/sidebar/program/program-sidebar_app';

import { ListView, LayoutView } from 'js/apps/programs/programs-all/programs-all_views';

export default App.extend({
  initialize() {
    this.addChildApp('programSidebar', new ProgramSidebarApp({
      region: Radio.request('sidebar', 'region'),
    }));
  },
  onBeforeStart() {
    const view = this.setView(new LayoutView());

    view.render();
    view.getRegion('list').startPreloader({ variant: 'generic' });

    this.listenTo(view, 'click:add', this.onClickAdd);
    this.showView();
  },
  prepareStart(options, { signal }) {
    return Radio.request('entities', 'fetch:programs:collection', { signal });
  },
  onStart(app, options, collection) {
    this.programs = collection;
    this.getView().showChildView('list', new ListView({ collection }));
  },
  onClickAdd() {
    const programSidebar = this.getChildApp('programSidebar');
    const program = Radio.request('entities', 'programs:model', {});
    Radio.request('sidebar', 'start', programSidebar, { program });

    this.listenToOnce(programSidebar, 'stop', () => {
      if (!program.isNew()) this.programs.add(program);
    });
  },
});
