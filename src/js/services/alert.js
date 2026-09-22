import { delay, each } from 'underscore';

import App from 'js/base/app';

import { AlertView, AlertsView } from 'js/services/alert/alert-box_views';

// in ms
const ALERT_TIMEOUT = 4000;

export default App.extend({
  channelName: 'alert',
  radioRequests: {
    'show': 'showAlert',
    'show:success': 'showSuccess',
    'show:error': 'showError',
    'show:apiError': 'showApiError',
  },
  showAlert(options) {
    const alertView = new AlertView(options);

    delay(function() {
      alertView.dismiss();
    }, ALERT_TIMEOUT);

    let alertsView = this.getView();

    if (!alertsView) {
      alertsView = this.showView(new AlertsView());
    }

    return alertsView.addChildView(alertView);
  },
  showSuccess(text) {
    this.showAlert({ text, alertType: 'success' });
  },
  showError(text) {
    this.showAlert({ text, alertType: 'error' });
  },
  showApiError(responseJson) {
    const errors = responseJson.errors;

    /* istanbul ignore if */
    if (!errors.length) return;

    each(errors, error => this.showAlert({ text: error.detail, alertType: 'error' }));
  },
});
