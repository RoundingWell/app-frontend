import { Radio } from 'marionette';

import App from 'js/base/app';

import { PROGRAM_BEHAVIORS } from 'js/static';

import { LayoutView } from 'js/apps/programs/program/program_views';
import { LoadingView } from 'js/regions/preload_region';

export default App.extend({
  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },
  prepareStart({ programId }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:programs:model', programId, { signal }),
      Radio.request('entities', 'fetch:programFlows:collection:byProgram', { programId }, { signal }),
      Radio.request('entities', 'fetch:programActions:collection:byProgram', { programId }, { signal }),
    ]);
  },
  onStart(app, options, [program, flows, actions]) {
    const actionsByBehavior = actions.groupBy('behavior');

    this.showView(new LayoutView({
      model: program,
      flows,
      standardActions: Radio.request('entities', 'programActions:collection', actionsByBehavior[PROGRAM_BEHAVIORS.STANDARD]),
      automatedActions: Radio.request('entities', 'programActions:collection', actionsByBehavior[PROGRAM_BEHAVIORS.AUTOMATED]),
    }));
  },
});
