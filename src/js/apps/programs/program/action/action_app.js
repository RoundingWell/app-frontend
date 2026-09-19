import { Radio } from 'marionette';

import intl from 'js/i18n';

import { PROGRAM_BEHAVIORS } from 'js/static';

import App from 'js/base/app';

import ActionSidebarApp from 'js/apps/programs/sidebar/action/action-sidebar_app';

export default App.extend({
  initialize() {
    this.addChildApp('actionSidebar', new ActionSidebarApp());
  },
  async prepareStart({ actionId, programId, flowId }, { signal }) {
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

    try {
      return await Radio.request('entities', 'fetch:programActions:model', actionId, { signal });
    } catch(error) {
      if (!signal.aborted) {
        Radio.request('alert', 'show:error', intl.programs.program.action.actionApp.notFound);
      }

      throw error;
    }
  },
  onStart(app, options, action) {
    this.action = action;

    const actionSidebar = this.getChildApp('actionSidebar');
    Radio.request('sidebar', 'start', actionSidebar, { action });
  },
});
