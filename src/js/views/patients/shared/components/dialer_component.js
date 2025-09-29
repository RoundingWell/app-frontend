import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { Component } from 'marionette.toolkit';

import intl from 'js/i18n';

import 'scss/modules/buttons.scss';

import Optionlist from 'js/components/optionlist';

import './dialer-component.scss';

const i18n = intl.patients.shared.components.dialerComponent;

export default Component.extend({
  initialize({ action }) {
    this.field = this.getField(action);
  },
  getField(action) {
    const patient = action.getPatient();

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

    phones.each(model => {
      model.set('onSelect', () => {
        Radio.request('dialer', 'call', model.get('number'));
      });
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
      },
      className: 'button-secondary w-100 action-sidebar__dialer-button',
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
      attr: 'number',
      ui: view.$el,
      uiView: view,
      headingText: i18n.headingText,
      itemTemplate: hbs`
        <span class="dialer-component__phone-icon">{{far "phone"}}</span>
        {{formatPhoneNumber number}}
        <span class="dialer-component__phone-label">
          <span class="dialer-component__phone-label-default">{{label}}</span>
          <span class="dialer-component__phone-label-call">
            {{ @intl.patients.shared.components.dialerComponent.callLabel }}{{far "arrow-up-right-from-square"}}
          </span>
        </span>
      `,
      lists,
      isListsAsync: true,
      popWidth: view.$el.outerWidth(),
    });

    optionlist.show();
  },
});
