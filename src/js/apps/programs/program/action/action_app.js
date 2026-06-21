import Radio from 'backbone.radio';

import intl from 'js/i18n';

import { PROGRAM_BEHAVIORS } from 'js/static';

import App from 'js/base/app';

import ActionSidebarApp from 'js/apps/programs/sidebar/action/action-sidebar_app';

export default App.extend({
  childApps: {
    actionSidebar: ActionSidebarApp,
  },
  beforeStart({ actionId, programId, flowId }) {
    if (!actionId) {
      return Radio.request('entities', 'programActions:model', {
        _program: { id: programId, type: 'programs' },
        _program_flow: flowId ? { id: flowId, type: 'program-flows' } : null,
        _owner: null,
        days_until_due: null,
        behavior: PROGRAM_BEHAVIORS.STANDARD,
        published_at: null,
        archived_at: null,
      });
    }

    return Radio.request('entities', 'fetch:programActions:model', actionId);
  },
  onFail() {
    Radio.request('alert', 'show:error', intl.programs.program.action.actionApp.notFound);
    this.stop();
  },
  onStart(options, action) {
    const actionSidebar = this.getChildApp('actionSidebar');
    Radio.request('sidebar', 'start', actionSidebar, { action });

    this.listenTo(actionSidebar, 'stop', this.stop);
  },
});
