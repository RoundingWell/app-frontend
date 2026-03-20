import App from 'js/base/app';

import { LayoutView } from './ringcentral_views';

export default App.extend({
  startAfterInitialized: true,
  onStart() {
    this.showView(new LayoutView({
      model: this.getState(),
    }));
  },
  call(number, action) {
    this.setState('isOpen', true);

    // If there's an active call, only show the panel
    if (this.getState('isCalling')) return;

    this.setState('pendingCall', number);
    this.setState('actionId', action.id);

    this._call();
  },
  _call() {
    const number = this.getState('pendingCall');
    if (!number) return;

    const iframe = document.querySelector('.rc-panel__iframe');
    if (!iframe) return;

    iframe.contentWindow.postMessage({
      type: 'rc-adapter-new-call',
      phoneNumber: number,
      toCall: true,
    }, '*');

    this.setState('pendingCall', null);
  },
});
