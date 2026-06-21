import { View } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/forms.scss';

import InputWatcherBehavior from 'js/behaviors/input-watcher';

import './list-search-component.scss';

const InputTemplate = hbs`
  <span class="list-search__search-icon">{{far "magnifying-glass"}}</span>
  <input
    class="list-search__input input-primary--small js-input w-100"
    type="text"
    placeholder="{{@intl.shared.components.listSearch.listSearchViews.placeholder}}"
    value="{{query}}"
  />
  <span class="list-search__clear-icon js-clear {{#unless query}}is-hidden{{/unless}}">{{fas "circle-xmark"}}</span>
`;

const SearchView = View.extend({
  behaviors: {
    InputWatcherBehavior,
  },
  className() {
    const query = this.getOption('state').query;

    if (query.length > 2) return 'list-search__container is-applied';

    return 'list-search__container';
  },
  template: InputTemplate,
  templateContext() {
    return {
      query: this.getOption('state').query,
    };
  },
  ui: {
    input: '.js-input',
    clear: '.js-clear',
  },
  triggers: {
    'click @ui.clear': 'clear',
  },
  onWatchChange(text) {
    this.ui.clear.toggleClass('is-hidden', !text.length);
    this.$el.toggleClass('is-applied', text.length > 2);
  },
  onClear() {
    this.ui.input.val('');
    this.ui.clear.addClass('is-hidden');
    this.$el.removeClass('is-applied');
  },
});

export {
  SearchView,
};
