import { View } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';
import 'scss/modules/forms.scss';

import InputWatcherBehavior from 'js/behaviors/input-watcher';

import './list-search-component.scss';

const INPUT_SELECTOR = '.js-input';
const CLEAR_SELECTOR = '.js-clear';

const InputTemplate = hbs`
  <span class="list-search__search-icon">{{far "magnifying-glass"}}</span>
  <input
    class="list-search__input form-input form-input--primary form-input--small js-input w-100"
    type="text"
    placeholder="{{@intl.shared.components.listSearch.listSearchViews.placeholder}}"
    value="{{query}}"
  />
  <button class="button button--icon list-search__clear-icon js-clear {{#unless query}}is-hidden{{/unless}}" type="button" aria-label="{{ @intl.shared.components.listSearch.listSearchViews.clearSearch }}">{{fas "circle-xmark"}}</button>
`;

const SearchView = View.extend({
  query: '',
  behaviors: {
    InputWatcherBehavior,
  },
  className() {
    const query = this.getOption('query');

    if (query.length > 2) return 'list-search__container is-applied';

    return 'list-search__container';
  },
  template: InputTemplate,
  templateContext() {
    return {
      query: this.getOption('query'),
    };
  },
  ui: {
    input: INPUT_SELECTOR,
    clear: CLEAR_SELECTOR,
  },
  triggers: {
    'click @ui.clear': 'clear',
  },
  onWatchChange(text) {
    this.options.query = text;
    this.el.querySelector(CLEAR_SELECTOR).classList.toggle('is-hidden', !text.length);
    this.el.classList.toggle('is-applied', text.length > 2);
    this.triggerMethod('change:query', text);
  },
  onClear() {
    this.options.query = '';
    this.el.querySelector(INPUT_SELECTOR).value = '';
    this.el.querySelector(CLEAR_SELECTOR).classList.add('is-hidden');
    this.el.classList.remove('is-applied');
    this.triggerMethod('change:query', '');
  },
});

export {
  SearchView,
};
