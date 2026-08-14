import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { Component } from 'marionette.toolkit';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Optionlist from 'js/components/optionlist';

import './dialer-component.scss';

const i18n = intl.patients.shared.components.dialerComponent;

export default Component.extend({
  initialize({ action }) {
    this.action = action;
    this.field = this.getField();
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

    this._lists = new Promise(resolve => {
      this.field.fetch().then(() => {
        const phones = this.getPhones();
        resolve([{ collection: phones }]);
      });
    });

    return this._lists;
  },
  getPhones() {
    const phones = new Backbone.Collection(this.field.get('value'), {
      comparator(model) {
        return model.get('preferred') ? 0 : 1;
      },
    });

    return phones;
  },
  viewEvents: {
    'click': 'onClick',
  },
  viewOptions() {
    const isDisabled = this.getState('isDisabled');

    return {
      tagName: 'button',
      attributes: {
        disabled: isDisabled,
        type: 'button',
      },
      className: 'button button--secondary dialer-component__button',
      template: hbs`{{far "phone"}}<span>{{ @intl.patients.shared.components.dialerComponent.defaultText }}</span>`,
      triggers: {
        'click': 'click',
      },
    };
  },
  onClick() {
    const view = this.getView();
    view.$el.blur();

    const lists = this.getLists();

    const optionlist = new Optionlist({
      ui: view.$el,
      uiView: view,
      headingText: i18n.headingText,
      itemTemplate: hbs`
        <span class="dialer-component__phone-icon">{{far "phone"}}</span>
        {{formatPhoneNumber number}}
        <span class="dialer-component__phone-label">
          <span class="picklist__default-content dialer-component__phone-label-default">{{label}}</span>
          <span class="picklist__highlight-content dialer-component__phone-label-call">
            {{ @intl.patients.shared.components.dialerComponent.callLabel }}{{far "arrow-up-right-from-square"}}
          </span>
        </span>
      `,
      lists,
      isListsAsync: true,
      popWidth: view.$el.outerWidth(),
    });

    this.listenTo(optionlist, 'select', model => {
      Radio.request('dialer', 'call', model.get('number'), this.action);
    });

    optionlist.show();
  },
});
