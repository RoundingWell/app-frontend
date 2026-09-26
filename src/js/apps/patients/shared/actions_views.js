import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl, { renderTemplate } from 'js/i18n';

import Tooltip from 'js/components/tooltip';

import trim from 'js/utils/formatting/trim';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import CheckView from './components/check_view';
import StateComponent from './components/state_component';
import OwnerComponent from './components/owner_component';
import DueView from './components/due_view';
import TimeComponent from './components/time_component';
import DurationComponent from './components/duration_component';

import './actions.scss';

function createCardControl(Component) {
  return Component.extend({
    className: `${ Component.prototype.className } js-no-click`,
  });
}

const CardOwnerComponent = createCardControl(OwnerComponent);
const CardDueView = createCardControl(DueView);
const CardTimeComponent = createCardControl(TimeComponent);

const FormButton = View.extend({
  className: 'button button--icon action-form-button',
  tagName: 'button',
  attributes: {
    'aria-label': intl.patients.shared.actionsViews.formButtonLabel,
    'type': 'button',
  },
  template: hbs`{{far "square-poll-horizontal"}}`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    const flow = this.model.getFlow();
    const entryTarget = { formExpanded: true };

    if (flow) {
      Radio.trigger(
        'event-router',
        'patient:flow:action',
        this.model.getPatient().id,
        flow.id,
        this.model.id,
        entryTarget,
      );
      return;
    }

    Radio.trigger(
      'event-router',
      'patient:action',
      this.model.getPatient().id,
      this.model.id,
      entryTarget,
    );
  },
});

const DetailsTooltip = View.extend({
  tagName: 'button',
  className: 'button button--icon action-details-tooltip',
  attributes() {
    return {
      'aria-describedby': `action-details-tooltip-${ this.cid }`,
      'aria-label': intl.patients.shared.actionsViews.detailsTooltipLabel,
      'type': 'button',
    };
  },
  template: hbs`{{far "circle-info"}}`,
  events: {
    'click': stopEventPropagation,
  },
  onRender() {
    const template = hbs`
      {{#if flowName}}<p class="action-tooltip__flow"><span class="action-tooltip__flow-icon">{{fas "folder"}}</span>{{ flowName }}</p>{{/if}}
      <p><span class="action-tooltip__action-icon">{{far "file-lines"}}</span><span class="action-tooltip__action-name">{{ name }}</span></p>
      <p class="action-tooltip__action-details">{{ details }}</p>
    `;

    const flow = this.model.getFlow();

    new Tooltip({
      id: `action-details-tooltip-${ this.cid }`,
      messageHtml: renderTemplate(template, {
        name: this.model.get('name'),
        flowName: flow ? flow.get('name') : null,
        details: this._formatDetails(this.model.get('details')),
      }),
      uiView: this,
      anchor: this.el,
      shouldDelay: true,
    });
  },
  _formatDetails(details) {
    if (!details || details.length <= 140) return details;

    return `${ trim(details.slice(0, 140)) }...`;
  },
});

export {
  CheckView,
  StateComponent,
  OwnerComponent,
  DueView,
  TimeComponent,
  CardOwnerComponent,
  CardDueView,
  CardTimeComponent,
  DurationComponent,
  FormButton,
  DetailsTooltip,
};
