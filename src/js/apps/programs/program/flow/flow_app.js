import { Radio } from 'marionette';

import App from 'js/base/app';

import { LayoutView } from 'js/apps/programs/program/flow/flow_views';
import { LoadingView } from 'js/regions/preload_region';

export default App.extend({
  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },
  prepareStart({ flowId }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:programs:model:byProgramFlow', flowId, { signal }),
      Radio.request('entities', 'fetch:programFlows:model', flowId, { signal }),
      Radio.request('entities', 'fetch:programActions:collection:byProgramFlow', flowId, { signal }),
    ]);
  },
  onStart(app, options, [program, flow, actions]) {
    this.showView(new LayoutView({ model: flow, program, actions }));
  },
});
