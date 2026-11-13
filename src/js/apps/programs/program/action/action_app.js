import { Radio } from 'marionette';

import intl from 'js/i18n';

import { PROGRAM_BEHAVIORS } from 'js/static';

import App from 'js/base/app';

import ActionSidebarApp from 'js/apps/programs/sidebar/action/action-sidebar_app';

export default App.extend({
  childApps: {
    actionSidebar: ActionSidebarApp,
  },
  prepareStart({ actionId, programId, flowId }, { signal }) {
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

    return Radio.request('entities', 'fetch:programActions:model', actionId, { signal });
  },
  handleStartFailure() {
    Radio.request('alert', 'show:error', intl.programs.program.action.actionApp.notFound);
  },
  onStart(app, options, action) {
    this.action = action;
  },
  async showSidebar(options, { signal }) {
    const started = await this.start(options);
    if (!started || signal.aborted) return;

    const sidebar = await Radio.request('sidebar', 'start', this.getChildApp('actionSidebar'), {
      action: this.action,
    });
    if (!sidebar || signal.aborted || !this.isRunning()) return;
    return this;
  },
});
