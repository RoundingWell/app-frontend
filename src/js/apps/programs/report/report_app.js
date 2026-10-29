import { Radio } from 'marionette';

import SubRouterApp from 'js/base/subrouterapp';

import { LoadingView } from 'js/regions/preload_region';

import { isPublishedProgram } from './report-data';
import { LayoutView } from './report_views';

export default SubRouterApp.extend({
  routeScope: ['programId', 'flowId'],
  routeActions: {
    'program:details': 'showOverview',
    'program:action': 'showAction',
    'programFlow': 'showOverview',
    'programFlow:action': 'showAction',
  },
  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },
  async prepareStart({ programId, flowId }, { signal }) {
    const program = await (flowId ?
      Radio.request('entities', 'fetch:programs:model:byProgramFlow', flowId, { signal }) :
      Radio.request('entities', 'fetch:programs:model', programId, { signal }));

    signal.throwIfAborted();

    if (!isPublishedProgram(program)) {
      throw Object.assign(new Error('Program unavailable'), { response: { status: 404 } });
    }

    const [flows, actions, flow] = await Promise.all([
      Radio.request('entities', 'fetch:programFlows:collection:byProgram', { programId: program.id }, { signal }),
      flowId ?
        Radio.request('entities', 'fetch:programActions:collection:byProgramFlow', flowId, { signal }) :
        Radio.request('entities', 'fetch:programActions:collection:byProgram', { programId: program.id }, { signal }),
      flowId ? Radio.request('entities', 'fetch:programFlows:model', flowId, { signal }) : null,
    ]);

    signal.throwIfAborted();

    return { program, flows, actions, flow };
  },
  onStart(app, options, data) {
    this.showView(new LayoutView({ model: data.program, ...data }));
    this.startCurrentRoute();
  },
  showOverview() {
    this.getView().focusHeading();
  },
  showAction(parentId, actionId) {
    this.getView().focusAction(actionId);
  },
});
