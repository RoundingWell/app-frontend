import { range } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/loader.scss';
import 'scss/modules/skeleton.scss';

import LoadingTemplate from './loading.hbs';

import './interactions-status.scss';

const InteractionsLoadingView = View.extend({
  className: 'patient-interactions-loading skeleton-loading',
  attributes: { 'role': 'status', 'aria-busy': 'true' },
  template: LoadingTemplate,
  templateContext() {
    return { items: range(3) };
  },
});

const InteractionsErrorView = View.extend({
  className: 'patient-interactions__status',
  attributes: { role: 'alert' },
  template: hbs`
    {{ @intl.patients.shared.interactions.interactionsStatusViews.loadError }}
    {{#if canRetry}}<button class="button button--link js-retry" type="button">{{ @intl.patients.shared.interactions.interactionsStatusViews.retry }}</button>{{/if}}
  `,
  ui: { retry: '.js-retry' },
  triggers: { 'click @ui.retry': 'retry' },
  templateContext() {
    return { canRetry: this.getOption('canRetry') };
  },
});

export { InteractionsLoadingView, InteractionsErrorView };
