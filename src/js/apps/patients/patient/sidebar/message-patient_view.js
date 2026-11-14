import Backbone from 'backbone';
import { isEqual } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView, Radio } from 'marionette';

import intl from 'js/i18n';
import dayjs from 'dayjs';
import { formatDate } from 'js/base/dayjs';
import ChoiceView from 'js/apps/patients/shared/messaging/choice_view';
import ContextSession from 'js/apps/patients/shared/messaging/context-session';
import { requestComposer } from 'js/apps/patients/shared/messaging/composer-intent';
import { CONTRACT_PATIENT_ID, isMessageAction } from 'js/entities-service/messaging-prototype/contract';

import './message-patient.scss';

function openPolicy(projection, stateId) {
  if (!projection || projection.state_id !== stateId) return false;
  return projection.composer?.enabled === true && !projection.composer.scheduled_interaction_id;
}

const ConsentRowView = View.extend({
  className: 'messaging-widget__preference',
  template: hbs`<span>{{formatPhoneNumber number}}</span><div data-choice-region></div>`,
  regions: { choice: '[data-choice-region]' },
  childViewEvents: {
    'change:selected'(selected) {
      this.triggerMethod('consent:changed', { number: this.model.get('number'), state: selected.id });
    },
  },
  onRender() {
    const copy = intl.patients.messaging;
    this.showChildView('choice', new ChoiceView({
      className: 'button button--secondary js-consent',
      choices: [{ id: 'opted_in', text: copy.optedIn }, { id: 'opted_out', text: copy.optedOutLabel }],
      selectedId: this.model.get('state'), label: `${ this.model.get('number') } · ${ copy.consentScenarios }`,
      disabled: !this.model.get('canChange'),
    }));
  },
});

const ConsentListView = CollectionView.extend({
  childView: ConsentRowView,
  childViewTriggers: { 'consent:changed': 'change:consent' },
});

export default View.extend({
  className: 'patient-sidebar__card messaging-widget',
  template: hbs`
    <h2 class="patient-sidebar__card-heading">{{ @intl.patients.messaging.messagePatient }}</h2>
    <h3 class="messaging-widget__subheading">{{ @intl.patients.messaging.optInStatus }}</h3>
    {{#if loading}}<p>{{ @intl.patients.messaging.loading }}</p>{{else}}{{#if unavailable}}<p>{{ @intl.patients.messaging.contextError }}</p>{{else}}{{#if dnc}}<p>{{ @intl.patients.messaging.dnc }}</p>{{else}}{{#each numbers}}<div class="messaging-widget__number{{#unless optedIn}} messaging-widget__opted-out{{/unless}}"><span>{{formatPhoneNumber number}}</span> <span>{{ stateLabel }}</span>{{#if stopped}}<p class="messaging-widget__stop-reason">{{ @intl.patients.messaging.patientStopped }}</p>{{/if}}</div>{{else}}<p>{{ @intl.patients.messaging.noMobile }}</p>{{/each}}{{/if}}{{/if}}{{/if}}
    {{#if openActions}}<h3 class="messaging-widget__subheading">{{ @intl.patients.messaging.openMessageActions }}</h3>
      {{#each openActions}}<button class="button button--text messaging-widget__action js-open-action" data-action-id="{{ id }}" type="button"><span>{{ name }}</span><span>{{ state }}{{#if due}} · {{ due }}{{/if}} ›</span></button>{{/each}}
    {{/if}}
    {{#if actionsError}}<p role="status">{{ @intl.patients.messaging.openActionsError }}</p>{{/if}}
    <button class="button button--outline js-message-patient" type="button" {{#unless enabled}}disabled{{/unless}}>{{far "paper-plane-top"}} {{ @intl.patients.messaging.messagePatient }}</button>
    {{#if canEditScenario}}<details class="messaging-widget__scenarios js-scenarios" {{#if scenariosOpen}}open{{/if}}>
      <summary>{{ @intl.patients.messaging.consentScenarios }}</summary>
      <p>{{ @intl.patients.messaging.prototypePreferences }}</p>
      <div data-consent-region></div>
      <button class="button button--checkbox js-dnc" type="button" role="checkbox" aria-checked="{{#if dnc}}true{{else}}false{{/if}}" {{#if pending}}disabled{{/if}}>{{#if dnc}}{{fas "square-check" classes="button__checkbox-icon button__checkbox-icon--selected"}}{{else}}{{fal "square" classes="button__checkbox-icon button__checkbox-icon--empty"}}{{/if}} {{ @intl.patients.messaging.dnc }}</button>
      <p role="status">{{ status }}</p>
    </details>{{/if}}
  `,
  regions: { consent: '[data-consent-region]' },
  childViewTriggers: { 'change:consent': 'change:consent' },
  ui: { message: '.js-message-patient', scenarios: '.js-scenarios', dnc: '.js-dnc', action: '.js-open-action' },
  events: { 'click @ui.action': 'onClickAction' },
  triggers: { 'click @ui.message': 'click:message', 'click @ui.dnc': 'change:dnc' },
  modelEvents: { change: 'render' },
  templateContext() {
    const copy = intl.patients.messaging;
    return {
      numbers: (this.model.get('recipients') || []).map(row => ({ ...row,
        stateLabel: { opted_in: copy.optedIn, opted_out: copy.optedOutLabel }[row.state] || row.state,
        optedIn: row.state === 'opted_in', stopped: row.state === 'opted_out' && row.source?.kind === 'patient_stop', canChange: row.staffChangeAllowed && !this.pending,
      })),
      openActions: this.openActions(), actionsError: this.actionsError, canEditScenario: this.canEditScenario(), loading: this.model.get('loading'), unavailable: this.model.get('disabledReason') === 'load_error',
      dnc: this.context.value?.dnc, pending: this.pending, status: this.status, scenariosOpen: this.scenariosOpen,
    };
  },
  canEditScenario() {
    return this.patient.id === CONTRACT_PATIENT_ID && this.context.value?.messaging_enabled === true && Number.isInteger(this.context.value?.revision);
  },
  initialize({ patient }) {
    this.patient = patient;
    this.context = new ContextSession({ patientId: patient.id });
    this.model = this.context.state;
    this.actions = new Backbone.Collection();
    this.listenTo(this.context, 'context:updated', this.refreshActions);
  },
  openActions() {
    return this.actions.filter(action => {
      const projection = this.context.value?.actions?.[action.id];
      return isMessageAction(action, this.patient.id) && action.getState()?.get('status') !== 'done' && openPolicy(projection, action.get('_state')?.id);
    }).map(action => ({ id: action.id, name: action.get('name'), state: action.getState()?.get('name'),
      due: action.get('due_date') ? formatDate(dayjs(`${ action.get('due_date') } ${ action.get('due_time') || '00:00' }`), 'AT_TIME') : null,
    }));
  },
  async refreshActions() {
    this.actionsController?.abort();
    const controller = this.actionsController = new AbortController();
    try {
      const actions = await Radio.request('entities', 'fetch:messagingPrototype:actions', { patientId: this.patient.id, value: this.context.value }, { signal: controller.signal });
      if (controller.signal.aborted || this.isDestroyed()) return;
      this.setActions(actions);
    } catch {
      // The widget's independent composer eligibility remains fail-closed.
      if (!controller.signal.aborted && !this.isDestroyed()) {
        this.actions = new Backbone.Collection();
        this.actionsError = true;
        this.render();
      }
    }
  },
  setActions(actions) {
    this.stopListening(this.actions);
    this.actions = actions;
    const hadError = this.actionsError;
    this.actionsError = false;
    this.listenTo(actions, 'change:_state change:name change:due_date change:due_time', this.render);
    // An unchanged listing must not recreate the consent picker.
    if (hadError || !isEqual(this.renderedOpenActions, this.openActions())) this.render();
  },
  onClickAction(event) {
    const action = this.actions.get(event.delegateTarget.dataset.actionId);
    if (!action) return;
    const flow = action.getFlow();
    if (flow) Radio.trigger('event-router', 'patient:flow:action', this.patient.id, flow.id, action.id);
    else Radio.trigger('event-router', 'patient:action', this.patient.id, action.id);
  },
  onAttach() {
    if (this.started) return;
    this.started = true;
    this.context.refresh();
  },
  onClickMessage() {
    if (!this.model.get('enabled')) return;
    requestComposer(this.patient.id);
    Radio.trigger('event-router', 'patient:interactions', this.patient.id);
  },
  onBeforeRender() {
    if (this.isRendered()) this.scenariosOpen = this.getUI('scenarios')[0]?.open;
  },
  onRender() {
    this.renderedOpenActions = this.openActions();
    this.el.hidden = this.context.value?.messaging_enabled === false;
    if (!this.canEditScenario()) return;
    this.showChildView('consent', new ConsentListView({ collection: new Backbone.Collection(this.templateContext().numbers) }));
  },
  onChangeConsent(intent) {
    this.updatePreference({ operation: 'set_consent', ...intent });
  },
  onChangeDnc() {
    this.updatePreference({ operation: 'set_dnc', dnc: !this.context.value.dnc });
  },
  async updatePreference(intent) {
    if (this.pending) return;
    this.pending = true;
    this.status = intl.patients.messaging.updating;
    this.render();
    try {
      await Radio.request('entities', 'update:messagingPrototype:context', {
        patientId: this.patient.id, revision: this.context.value.revision, ...intent,
      }, { signal: new AbortController().signal });
      this.status = '';
    } catch {
      this.status = intl.patients.messaging.preferenceError;
    }
    if (this.isDestroyed()) return;
    this.pending = false;
    this.render();
  },
  onBeforeDestroy() {
    this.actionsController?.abort();
    this.context.destroy();
  },
});
