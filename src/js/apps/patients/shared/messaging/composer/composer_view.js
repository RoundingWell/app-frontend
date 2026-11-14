import { find, map } from 'underscore';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import ChoiceView from '../choice_view';

import message from './intl';
import { getComposerSession, updateDraft } from './session';
import { getAvailability, submitDraft } from './submission';

import LayoutTemplate from './layout.hbs';

import './composer.scss';

function visibleReason(state, body, reason) {
  return state.get('scheduled') && !body ? '' : reason;
}

export default View.extend({
  tagName: 'form',
  className: 'message-composer',
  template: LayoutTemplate,
  ui: { body: '.js-body', send: '.js-send', sendLabel: '.js-send-label', status: '.js-status', reason: '.js-reason', sender: '.js-sender', recipient: '.js-recipient' },
  triggers: { submit: 'submit:draft' },
  events: { 'input @ui.body': 'onInputBody' },
  regions: { numbers: '[data-number-region]' },
  initialize({ adapter, patientId, actionId, sessionScope }) {
    this.adapter = adapter;
    this.context = { patientId, actionId };
    this.session = getComposerSession({ sessionScope, patientId, actionId, initialNumberId: adapter.initialNumberId });
    const selected = find(adapter.state.get('numbers'), { id: this.session.get('numberId') });
    if (selected) this.session.set('numberLabel', selected.label);
    this.listenTo(adapter.state, 'change', this.onAdapterChange);
    this.listenTo(this.session, 'change', this.updateDraftControls);
    this.listenTo(this.session, 'confirmed', confirmation => this.triggerMethod('message:confirmed', confirmation));
  },
  templateContext() {
    const numberId = this.session.get('numberId');
    const numbers = map(this.adapter.state.get('numbers'), number => ({ ...number, available: number.available === true }));
    if (numberId && !find(numbers, { id: numberId })) {
      numbers.push({ id: numberId, label: this.session.get('numberLabel') || numberId, available: false, reason: message('removed') });
    }
    const reason = getAvailability(this.adapter.state, numberId);
    const name = this.adapter.state.get('recipientName');
    return {
      numbers,
      reason,
      reasonText: visibleReason(this.adapter.state, this.session.get('body'), reason),
      disabled: !!reason,
      hideSend: this.adapter.state.get('scheduled') === true,
      placeholder: reason || message('placeholder', { name: this.adapter.state.get('placeholderName') || name }),
      recipient: message('recipient', { name }),
      sender: this.adapter.state.get('senderName') ? message('sender', { name: this.adapter.state.get('senderName') }) : message('heading'),
      numberLabel: message('numberLabel'),
      chooseNumber: message('chooseNumber'),
      send: message('send'),
      bodyId: `message-body-${ this.cid }`,
      numberId: `message-number-${ this.cid }`,
      reasonId: `message-reason-${ this.cid }`,
      statusId: `message-status-${ this.cid }`,
    };
  },
  onRender() {
    this.el.hidden = this.adapter.state.get('enabled') !== true;
    const context = this.templateContext();
    const picker = new ChoiceView({
      id: context.numberId, className: 'button button--compact message-composer__numbers js-number',
      choices: context.numbers.map(number => ({ id: number.id, text: number.label, isDisabled: !number.available, reason: number.reason })),
      selectedId: this.session.get('numberId'), placeholder: context.chooseNumber, label: context.numberLabel, descriptionId: context.reasonId,
      disabled: !context.numbers.length,
    });
    this.listenTo(picker, 'change:selected', this.onChangeNumber);
    this.showChildView('numbers', picker);
    this.updateDraftControls();
    if (this.isAttached()) this.applyRequestedFocus();
  },
  onAttach() {
    this.growInput();
    if (this.getOption('focus')) this.focusComposer();
  },
  onAdapterChange() {
    if (!this.isRendered()) return;
    const context = this.templateContext();
    this.el.hidden = this.adapter.state.get('enabled') !== true;
    this.getUI('sender')[0].textContent = context.sender;
    this.getUI('recipient')[0].textContent = context.recipient;
    const input = this.getUI('body')[0];
    input.disabled = context.disabled;
    input.placeholder = context.placeholder;
    input.setAttribute('aria-label', context.placeholder);
    this.getUI('send')[0].hidden = context.hideSend;
    this.getChildView('numbers').updateChoices({
      choices: context.numbers.map(number => ({ id: number.id, text: number.label, isDisabled: !number.available, reason: number.reason })),
      selectedId: this.session.get('numberId'), disabled: this.el.hidden || !context.numbers.length,
    });
    this.updateDraftControls();
    if (this.isAttached()) this.applyRequestedFocus();
  },
  updateDraftControls() {
    if (!this.isRendered()) return;
    const { body, numberId, pending, error, status } = this.session.attributes;
    const input = this.getUI('body')[0];
    if (input.value !== body) input.value = body;
    const reason = getAvailability(this.adapter.state, numberId);
    const send = this.getUI('send')[0];
    send.disabled = pending || !body.trim() || !!reason;
    this.getUI('sendLabel')[0].textContent = message(pending ? 'sending' : 'send');
    this.getUI('status')[0].textContent = error || status;
    this.getUI('reason')[0].textContent = visibleReason(this.adapter.state, body, reason);
    this.el.setAttribute('aria-busy', String(pending));
    this.growInput();
  },
  growInput() {
    const input = this.getUI('body')[0];
    input.style.height = 'auto';
    input.style.height = `${ input.scrollHeight }px`;
  },
  onInputBody() {
    updateDraft(this.session, { body: this.getUI('body')[0].value });
  },
  onChangeNumber(selected) {
    const numberId = selected.id;
    const number = find(this.adapter.state.get('numbers'), { id: numberId });
    if (!number || number.available !== true) return;
    updateDraft(this.session, { numberId, numberLabel: number.label });
    this.render();
    this.getChildView('numbers').el.focus();
  },
  onSubmitDraft() {
    this.triggerMethod('message:submitting', this.context);
    return submitDraft(this.adapter, this.session, this.context);
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
