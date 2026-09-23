import hbs from 'handlebars-inline-precompile';
import { Radio } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

const i18n = intl.programs.shared.components.formComponent;

const FormTemplate = hbs`
  <button class="js-button button button--secondary flex-grow" type="button" {{#if isDisabled}}disabled{{/if}}>
    {{far "square-poll-horizontal"}}<span>{{ name }}</span>
  </button>
`;
const NoFormTemplate = hbs`
  <button class="js-button button button--secondary w-100" type="button" {{#if isDisabled}}disabled{{/if}}>
    {{far "square-poll-horizontal"}}<span>{{ @intl.programs.shared.components.formComponent.defaultText }}</span>
  </button>
`;

let currentWorkspaceCache;
let formsCollection;

function getForms(workspace) {
  if (formsCollection) return formsCollection;
  formsCollection = workspace.getForms();
  return formsCollection;
}

export default Droplist.extend({
  className: 'flex',
  tagName: 'div',
  getTemplate() {
    return this.getState().get('selected') ? FormTemplate : NoFormTemplate;
  },
  templateContext() {
    return { isDisabled: this.getState().get('isDisabled') };
  },
  triggers: {
    'click .js-button': 'click',
    'focus .js-button': 'focus',
  },
  picklistOptions: {
    canClear: true,
    headingText: i18n.headingText,
    placeholderText: i18n.placeholderText,
    noResultsText: i18n.noResultsText,
    isSelectlist: true,
    itemTemplateContext: {
      icon: {
        type: 'far',
        icon: 'square-poll-horizontal',
      },
    },
    attr: 'name',
  },
  initialize({ form }) {
    const currentWorkspace = Radio.request('workspace', 'current');

    if (currentWorkspaceCache !== currentWorkspace.id) {
      formsCollection = null;
      currentWorkspaceCache = currentWorkspace.id;
    }

    this.collection = getForms(currentWorkspace);

    this.getState().set({ selected: form });
  },
  popWidth() {
    return this.el.offsetWidth;
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:form', selected);
  },
});
