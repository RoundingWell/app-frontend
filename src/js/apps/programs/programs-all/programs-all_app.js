import Radio from 'backbone.radio';

import App from 'js/base/app';

import ProgramSidebarApp from 'js/apps/programs/sidebar/program/program-sidebar_app';

import { ListView, LayoutView } from 'js/apps/programs/programs-all/programs-all_views';

export default App.extend({
  childApps: {
    programSidebar: ProgramSidebarApp,
  },
  viewTriggers: {
    'click:add': 'click:add',
  },
  onBeforeStart() {
    this.showView(new LayoutView());
    this.getRegion('list').startPreloader();
  },
  beforeStart() {
    return Radio.request('entities', 'fetch:programs:collection');
  },
  onStart(options, collection) {
    this.programs = collection;
    this.showChildView('list', new ListView({ collection }));
  },
  onClickAdd() {
    const programSidebar = this.getChildApp('programSidebar');
    const program = Radio.request('entities', 'programs:model', {});
    const sidebar = Radio.request('sidebar', 'start', programSidebar, { program });

    this.listenTo(sidebar, 'stop', () => {
      if (!program.isNew()) this.programs.add(program);
    });
  },
});
