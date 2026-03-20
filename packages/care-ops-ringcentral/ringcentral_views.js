import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import './ringcentral.scss';

const StatusView = View.extend({
  getTemplate() {
    if (!this.model.get('isOpen')) return hbs`{{far "window-maximize"}}`;
    return hbs`{{far "window-minimize"}}`;
  },
});

const LayoutView = View.extend({
  className: 'rc-wrapper',
  template: hbs`
    <div class="rc-panel">
      <div class="rc-panel__header js-header">
        {{fas "phone"}}
        <span>RingCentral</span>
        <span data-status-region></span>
      </div>
      <iframe
        class="rc-panel__iframe"
        src="https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/app.html?clientId=e2M8xGmJjcGcHFuFe7epUC"
        title="RingCentral Dialer"
        loading="lazy"
        referrerpolicy="no-referrer"
        allow="microphone"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups">
      </iframe>
    </div>
  `,
  regions: {
    status: '[data-status-region]',
  },
  modelEvents: {
    'change:isOpen': 'onChangeIsOpen',
  },
  ui: {
    header: '.js-header',
  },
  triggers: {
    'click @ui.header': 'click:header',
  },
  onClickHeader() {
    this.model.set('isOpen', !this.model.get('isOpen'));
  },
  onChangeIsOpen() {
    this.togglePanel();
    this.showPanelStatus();
  },
  onRender() {
    this.showPanelStatus();
  },
  togglePanel() {
    this.$el.toggleClass('is-open', this.model.get('isOpen'));
  },
  showPanelStatus() {
    this.showChildView('status', new StatusView({ model: this.model }));
  },
});

export { LayoutView };
