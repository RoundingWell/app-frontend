import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import { getInteractionPresentation } from './interaction-presentation';

import './interaction-item.scss';

function getWorkName(model) {
  const action = model.getAction();
  const flow = action?.getFlow() || model.getFlow();
  return action && flow ? `${ flow.get('name') }: ${ action.get('name') }` : action?.get('name') || flow?.get('name');
}

const InteractionItemView = View.extend({
  tagName: 'li',
  className() {
    return `patient-interactions__item patient-interactions__item--${ this.model.get('channel') }`;
  },
  template: hbs`
    <span class="patient-interactions__marker" aria-hidden="true">{{far icon}}</span>
    <div class="patient-interactions__activity-body">
      <div class="patient-interactions__activity-line">
        <span class="patient-interactions__activity-description">{{#if subject}}<strong>{{ subject }}</strong> {{/if}}{{#if actor}}<strong>{{ actor }}</strong> {{/if}}<span class="patient-interactions__activity-label">{{ activityLabel }}</span> <span class="patient-interactions__time">{{#if viaLabel}}{{ viaLabel }}{{#if displayTime}} · {{/if}}{{/if}}<time datetime="{{ timestamp }}">{{ displayTime }}</time></span></span>
        {{#if workName}}<button class="patient-interactions__action js-action" type="button">{{ workName }} {{far "angle-right"}}</button>{{/if}}
      </div>
      <div class="patient-interactions__card">
        {{#if isVisit}}
          {{#if hasVisitHeading}}<div class="patient-interactions__item-heading">
            {{#if title}}<span class="patient-interactions__channel">{{ title }}</span>{{/if}}{{#if status}}{{#if title}}<span class="patient-interactions__separator">·</span>{{/if}}<span>{{ status }}</span>{{/if}}
          </div>{{/if}}
          {{#if admissionDate}}<p class="patient-interactions__detail">{{ @intl.patients.patient.interactions.admitted }} {{ admissionDate }}{{#if admitReason}} · {{ admitReason }}{{/if}}</p>{{else}}{{#if admitReason}}<p class="patient-interactions__detail">{{ admitReason }}</p>{{/if}}{{/if}}
          {{#if hasDischarge}}<p class="patient-interactions__detail">{{ @intl.patients.patient.interactions.discharged }} {{ dischargeDate }}{{#if hasStay}} · {{formatMessage @intl.patients.patient.interactions.lengthOfStay days=stayDays}}{{/if}}{{#if dischargeDisposition}} · {{ dischargeDisposition }}{{/if}}</p>{{else}}<p class="patient-interactions__detail"><em>{{ @intl.patients.patient.interactions.noDischarge }}</em>{{#if hasStay}} · {{formatMessage @intl.patients.patient.interactions.lengthOfStay days=stayDays}}{{/if}}</p>{{/if}}
        {{else}}{{#unless isMessage}}<div class="patient-interactions__item-heading">
          <span class="patient-interactions__channel">{{ title }}</span>{{#if status}}<span class="patient-interactions__separator">·</span><span>{{ status }}</span>{{/if}}
        </div>{{/unless}}
        {{#if summary}}<p class="patient-interactions__summary">{{ summary }}</p>{{/if}}
        {{#each details}}<p class="patient-interactions__detail">{{ label }}: {{ value }}</p>{{/each}}{{/if}}
      </div>
    </div>
  `,
  ui: { action: '.js-action' },
  triggers: {
    'click @ui.action': 'click:action',
  },
  modelEvents: { change: 'render' },
  setGrouping(continuation, continues) {
    this.el.classList.toggle('patient-interactions__item--continuation', continuation);
    this.el.classList.toggle('patient-interactions__item--continues', continues);
  },
  onClickAction() {
    const action = this.model.getAction();
    const flow = action?.getFlow() || this.model.getFlow();
    const patientId = this.getOption('patientId');

    if (flow) {
      if (action) {
        Radio.trigger('event-router', 'patient:flow:action', patientId, flow.id, action.id);
      } else {
        Radio.trigger('event-router', 'patient:flow', patientId, flow.id);
      }
      return;
    }

    Radio.trigger('event-router', 'patient:action', patientId, action.id);
  },
  templateContext() {
    const presentation = getInteractionPresentation(this.model, this.getOption('patientName'));
    return {
      ...presentation,
      isMessage: presentation.kind === 'message',
      isVisit: presentation.kind === 'visit',
      hasVisitHeading: presentation.title || presentation.status,
      workName: getWorkName(this.model),
    };
  },
  initialize() {
    const selection = this.getOption('selection');
    if (selection) this.listenTo(selection, 'change:interactionId', this.updateSelection);
  },
  isSelectedInteraction() {
    return this.model.id === this.getOption('selection')?.get('interactionId');
  },
  onRender() {
    this.updateSelection();
  },
  updateSelection() {
    const selected = this.isSelectedInteraction();
    this.el.classList.toggle('is-selected', selected);
    if (selected) this.el.tabIndex = -1;
    else this.el.removeAttribute('tabindex');
  },
  onAttach() {
    if (this.didFocusInteraction || !this.isSelectedInteraction()) return;
    this.focusInteraction();
  },
  focusInteraction() {
    this.didFocusInteraction = true;
    this.el.scrollIntoView({ block: 'center' });
    this.el.focus({ preventScroll: true });
  },
});

export default InteractionItemView;
