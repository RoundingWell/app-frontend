import { extend, isFunction, find, get } from 'underscore';
import Radio from 'backbone.radio';
import { View } from 'marionette';
import dayjs from 'dayjs';

import hbs from 'handlebars-inline-precompile';

import Handlebars from 'handlebars/dist/cjs/handlebars';

import './widgets.scss';

function getWrapperTemplate(definition) {
  const template = get(definition, 'wrapperTemplate');

  if (!template) return;

  return { wrapperTemplate: Handlebars.compile(template) };
}

// NOTE: widget is a view or view definition
export function buildWidget(widget, patient, widgetModel, options) {
  const definition = widgetModel.get('definition');

  const wrapperTemplate = getWrapperTemplate(definition);

  if (isFunction(widget)) return new widget(extend({ model: patient, slug: widgetModel.get('slug') }, options, definition, wrapperTemplate));

  return new View(extend({ model: patient }, options, definition, wrapperTemplate, widget));
}

// NOTE: These widgets are documented in ./README.md

const widgets = {
  widget: View.extend({
    className: 'widgets-value',
    initialize() {
      const slug = this.getOption('slug');
      const widgetValues = Radio.request('entities', 'get:widgetValues:model', slug, this.model.id);
      this.values = widgetValues.get('values');

      this.template = Handlebars.compile(this.template);
    },
    serializeData() {
      return this.values;
    },
  }),
  dob: {
    modelEvents: {
      'change:birth_date': 'render',
    },
    template: hbs`{{formatHTMLMessage (intlGet "patients.widgets.widgets.dob") dob=(formatDateTime dob "LONG" inputFormat="YYYY-MM-DD") age=age}}`,
    templateContext() {
      const dob = this.model.get('birth_date');

      const age = dayjs().diff(dayjs(dob, 'YYYY-MM-DD'), 'years');

      return { dob, age };
    },
  },
  sex: {
    modelEvents: {
      'change:sex': 'render',
    },
    template: hbs`{{formatMessage (intlGet "patients.widgets.widgets.sex") sex=sex}}`,
  },
  status: View.extend({
    template: hbs`<span class="widgets__status-{{ status }}">{{formatMessage (intlGet "patients.widgets.widgets.status") status=status}}</span>`,
    initialize() {
      this.workspacePatient = this.model.getWorkspacePatient();

      this.listenTo(this.workspacePatient, 'change:status', this.render);
    },
    templateContext() {
      return {
        status: this.workspacePatient.get('status'),
      };
    },
  }),
  divider: {
    template: hbs`<div class="widgets__divider"></div>`,
  },
  workspaces: {
    modelEvents: {
      'change:_workspaces': 'render',
    },
    template: hbs`{{#each workspaces}}<div>{{ this }}</div>{{/each}}`,
    templateContext() {
      return {
        workspaces: this.model.getWorkspaces().map('name'),
      };
    },
  },
  patientIdentifiers: {
    className: 'widgets-value',
    template: hbs`{{ displayValue }}{{#unless displayValue}}{{{ defaultHtml }}}{{/unless}}`,
    templateContext() {
      const defaultHtml = this.getOption('default_html');
      const identifiersArray = this.model.get('identifiers');
      const identifierType = this.getOption('identifier_type');

      const identifier = find(identifiersArray, { type: identifierType });

      return {
        displayValue: identifier && identifier.value,
        defaultHtml,
      };
    },
  },
  formWidget: View.extend({
    className: 'button-primary widgets__form-widget',
    tagName: 'button',
    attributes() {
      return {
        disabled: this.getOption('is_modal'),
      };
    },
    template: hbs`
      {{far "square-poll-horizontal"}}
      <span class="u-text--overflow">{{formName}}</span>
      <span class="widgets__form-widget-expand-icon">{{fas "up-right-and-down-left-from-center"}}</span>`,
    templateContext() {
      return {
        formName: this.getOption('form_name'),
      };
    },
    initialize({ is_modal, form_id }) {
      if (is_modal) {
        const fetchForm = Radio.request('entities', 'fetch:forms:model', form_id);
        fetchForm.then(form => {
          this.form = form;
          this.$el.prop('disabled', false);
        });
      }
    },
    triggers: {
      'click': 'click',
    },
    onClick() {
      if (this.getOption('is_modal')) {
        Radio.request('modal', 'show:form', this.model, this.getOption('form_name'), this.form, this.getOption('modal_size'));
        return;
      }
      Radio.trigger('event-router', 'form:patient', this.model.id, this.getOption('form_id'));
    },
  }),
};

export default widgets;
