import App from 'js/base/app';

import { LayoutView } from './ringcentral_views';

export default App.extend({
  startAfterInitialized: true,
  onStart() {
    this.showView(new LayoutView({
      model: this.getState(),
    }));
  },
});
