import { find, map } from 'underscore';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/textarea-flex.scss';

import ChoiceView from '../choice_view';

import message from './intl';
import { updateDraft } from './session';
import { getAvailability } from './submission';

import LayoutTemplate from './layout.hbs';

import './composer.scss';

export default View.extend({
  tagName: 'form',
  className: 'message-composer',
  template: LayoutTemplate,
  ui: { body: '.js-body', spacer: '.js-spacer', send: '.js-send', sendLabel: '.js-send-label', status: '.js-status', reason: '.js-reason', sender: '.js-sender', recipient: '.js-recipient' },
  triggers: { submit: 'submit:message' },
  events: { 'input @ui.body': 'onInputBody' },
  regions: { numbers: '[data-number-region]' },
  modelEvents: { change: 'syncControls' },
  stateEvents: { change: 'syncControls' },
  templateContext() {
    return {
      bodyId: `message-body-${ this.cid }`, numberId: `message-number-${ this.cid }`,
      reasonId: `message-reason-${ this.cid }`, statusId: `message-status-${ this.cid }`,
    };
  },
  recipientChoices() {
    const { numberId, numberLabel } = this.model.attributes;
    const choices = map(this.getState().get('numbers'), number => ({ id: number.id, text: number.label, isDisabled: number.available !== true, reason: number.reason }));
    if (numberId && !find(choices, { id: numberId })) {
      choices.push({ id: numberId, text: numberLabel || numberId, isDisabled: true, reason: message('removed') });
    }
    return choices;
  },
  presentation() {
    const state = this.getState();
    const { body, numberId, pending, uncertain, error, status } = this.model.attributes;
    const reason = getAvailability(state, numberId);
    const name = state.get('recipientName');
    return {
      body, numberId, pending, choices: this.recipientChoices(), hidden: state.get('enabled') !== true,
      disabled: !!reason, sendDisabled: pending || uncertain || !body.trim() || !!reason,
      hideSend: state.get('scheduled') === true,
      reason: state.get('scheduled') && !body ? '' : reason,
      ...this.headings(reason, name),
      status: error || this.submissionStatus(uncertain, status), sendLabel: message(pending ? 'sending' : 'send'),
    };
  },
  submissionStatus(uncertain, status) {
    return uncertain ? message('unconfirmed') : status;
  },
  headings(reason, name) {
    const state = this.getState();
    return {
      placeholder: reason || message('placeholder', { name: state.get('placeholderName') || name }),
      recipient: message('recipient', { name }),
      sender: state.get('senderName') ? message('sender', { name: state.get('senderName') }) : message('heading'),
    };
  },
  onRender() {
    const picker = new ChoiceView({
      id: `message-number-${ this.cid }`, className: 'button button--compact message-composer__numbers js-number',
      choices: [], placeholder: message('chooseNumber'), label: message('numberLabel'),
      descriptionId: `message-reason-${ this.cid }`, disabled: true,
    });
    this.listenTo(picker, 'change:selected', this.onChangeNumber);
    this.showChildView('numbers', picker);
    this.syncControls();
  },
  onAttach() {
    if (this.getOption('focus')) this.focusComposer();
  },
  syncControls() {
    if (!this.isRendered()) return;
    const context = this.presentation();
    this.el.hidden = context.hidden;
    this.el.setAttribute('aria-busy', String(context.pending));
    this.getUI('sender')[0].textContent = context.sender;
    this.getUI('recipient')[0].textContent = context.recipient;
    const input = this.getUI('body')[0];
    if (input.value !== context.body) input.value = context.body;
    input.disabled = context.disabled;
    input.placeholder = context.placeholder;
    input.setAttribute('aria-label', context.placeholder);
    this.getUI('spacer')[0].textContent = context.body || ' ';
    const send = this.getUI('send')[0];
    send.hidden = context.hideSend;
    send.disabled = context.sendDisabled;
    this.getUI('sendLabel')[0].textContent = context.sendLabel;
    this.getUI('status')[0].textContent = context.status;
    this.getUI('reason')[0].textContent = context.reason;
    this.getChildView('numbers').updateChoices({ choices: context.choices, selectedId: context.numberId, disabled: context.hidden || !context.choices.length });
    if (this.isAttached()) this.applyRequestedFocus();
  },
  onInputBody() {
    updateDraft(this.model, { body: this.getUI('body')[0].value });
  },
  onChangeNumber(selected) {
    if (selected.id === this.model.get('numberId')) return;
    const number = find(this.getState().get('numbers'), { id: selected.id });
    if (!number || number.available !== true) return;
    updateDraft(this.model, { numberId: number.id, numberLabel: number.label });
  },
  focusComposer() {
    this.focusRequested = true;
    this.applyRequestedFocus();
  },
  applyRequestedFocus() {
    if (!this.focusRequested || this.el.hidden) return;
    const input = this.getUI('body')[0];
    const target = input.disabled ? this.getChildView('numbers').el : input;
    if (target.disabled) return;
    this.focusRequested = false;
    this.el.scrollIntoView({ block: 'end' });
    target.focus({ preventScroll: true });
  },
});
