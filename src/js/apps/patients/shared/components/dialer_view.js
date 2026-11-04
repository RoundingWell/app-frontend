import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';
import { addError } from 'js/datadog';

import Optionlist from 'js/components/optionlist';

import './dialer-component.scss';

const i18n = intl.patients.shared.components.dialerView;

export default View.extend({
  tagName: 'button',
  className() {
    const link = this.isCallLive() ? ' js-link-call' : '';

    return `button button--compact dialer-component__button${ link }`;
  },
  attributes() {
    const disabled = this.isLinked() || (!this.isCallLive() && this.getOption('isDisabled'));

    return {
      type: 'button',
      disabled: disabled ? 'disabled' : null,
    };
  },
  template: hbs`{{far "phone"}}<span>{{ label }}</span>`,
  templateContext() {
    return { label: this.buttonLabel() };
  },
  triggers: {
    'click': 'click',
  },
  initialize({ action }) {
    this.action = action;
    this.field = this.getField();
    this.callLink = Radio.request('dialer', 'callLink') || { callLive: false, linkedAction: null };
    this.listenTo(Radio.channel('dialer'), 'change:callLink', this.onCallLink);
    this.renderAttributes();
  },
  onCallLink(callLink) {
    this.callLink = callLink || { callLive: false, linkedAction: null };
    this.render();
    this.renderAttributes();
  },
  isCallLive() {
    return Boolean(this.callLink?.callLive);
  },
  isLinked() {
    const linked = this.callLink?.linkedAction;

    return Boolean(this.isCallLive() && linked && linked.actionId === this.action.id);
  },
  buttonLabel() {
    if (this.isLinked()) return i18n.linkedText;
    if (this.isCallLive()) return i18n.linkCallText;

    return i18n.defaultText;
  },
  linkPayload() {
    const patient = this.action.getPatient();
    if (!patient?.id) return null;

    return {
      id: this.action.id,
      patientId: patient.id,
      patientName: [patient.get('first_name'), patient.get('last_name')].filter(Boolean).join(' '),
    };
  },
  getField() {
    const patient = this.action.getPatient();

    return Radio.request('entities', 'patientFields:model', {
      name: 'phones',
      _patient: patient.getResource(),
    });
  },
  getLists() {
    if (this._lists) return this._lists;

    this._lists = this.field.fetch().then(() => {
      return [{ collection: this.getPhones() }];
    }).catch(/* istanbul ignore next: defensive cache reset after a failed phone lookup */ error => {
      this._lists = null;
      throw error;
    });

    return this._lists;
  },
  getPhones() {
    return new Backbone.Collection(this.field.get('value'), {
      comparator(model) {
        return model.get('preferred') ? 0 : 1;
      },
    });
  },
  onClick() {
    if (this.isCallLive()) {
      this.linkLiveCall();
      return;
    }

    this.showPhoneList();
  },
  linkLiveCall() {
    const action = this.linkPayload();
    if (!action || this.isLinked()) return;

    this.el.blur();
    Radio.trigger('dialer', 'link:call', action);
  },
  showPhoneList() {
    this.el.blur();

    const optionlist = new Optionlist({
      anchor: this.el,
      uiView: this,
      headingText: i18n.headingText,
      itemTemplate: hbs`
        <span class="dialer-component__phone-icon">{{far "phone"}}</span>
        <span class="dialer-component__phone-number">{{formatPhoneNumber number}}</span>
        <span class="dialer-component__phone-label">
          <span class="picklist__default-content dialer-component__phone-label-default">{{label}}</span>
          <span class="picklist__highlight-content dialer-component__phone-label-call">
            {{ @intl.patients.shared.components.dialerView.callLabel }}{{far "arrow-up-right-from-square"}}
          </span>
        </span>
      `,
      lists: this.getLists(),
      isListsAsync: true,
      popWidth: 216,
    });

    this.listenTo(optionlist, 'load:error', addError);
    this.listenTo(optionlist, 'select', model => {
      Radio.request('dialer', 'call', model.get('number'), this.action);
    });

    optionlist.show();
  },
});
