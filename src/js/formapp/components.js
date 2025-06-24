/* global Formio */
import { debounce, isString } from 'underscore';
const NestedComponent = Formio.Components.components.nested;
const SelectComponent = Formio.Components.components.select;

// Modifies the emptyValue to avoid error on php mutating {} to []
class SurveyComponent extends Formio.Components.components.survey {
  get emptyValue() {
    return [];
  }
}

Formio.Components.components.survey = SurveyComponent;

class DateTimeComponent extends Formio.Components.components.datetime {
  formatValue(date) {
    if (!isString(date) || !date.length) return date;

    return Formio.Utils.moment(date).format();
  }
}

Formio.Components.components.datetime = DateTimeComponent;

class SnippetComponent extends NestedComponent {
  constructor(...args) {
    super(...args);
    this.noField = true;
  }

  static schema(...extendArgs) {
    return NestedComponent.schema({
      label: 'Snippet',
      key: 'snippet',
      type: 'snippet',
      components: [],
      input: false,
      persistent: false,
      snippet: null,
    }, ...extendArgs);
  }
}

// NOTE: Outside of the schema much of the logic is slightly modified from SelectComponent
class DirectoryComponent extends SelectComponent {
  static schema(...extend) {
    return SelectComponent.schema({
      label: 'Directory',
      key: 'directory',
      type: 'directory',
      dataSrc: 'custom',
      searchField: true,
      customOptions: {
        noChoicesText: 'Type a minimum of 3 characters for results',
      },
    }, ...extend);
  }

  get defaultSchema() {
    return DirectoryComponent.schema();
  }

  constructor(...args) {
    super(...args);
    this.updateCustomItems = debounce(this.updateCustomItems, 300);
  }

  updateItems(searchInput, forceUpdate) {
    if (!this.visible) {
      this.itemsLoadedResolve();
      return;
    }

    this.updateCustomItems(forceUpdate, searchInput);
  }

  // NOTE: Biggest modification is exposing the searchInput to the custom code
  getCustomItems(searchInput) {
    if (!searchInput || searchInput.length < 3) return Promise.resolve([]);

    return this.evaluate(this.component.data.custom, {
      values: [],
      searchInput,
    }, 'values');
  }

  updateCustomItems(forceUpdate, searchInput) {
    if (!forceUpdate && !this.active) {
      this.itemsLoadedResolve();
      return;
    }

    this.loading = true;
    this.getCustomItems(searchInput)
      .then(items => {
        this.loading = false;
        this.setItems(items || []);
      })
      .catch(err => {
        this.handleLoadingError(err);
      });
  }
}

class CustomButtonComponent extends Formio.Components.components.button {
  get shouldDisabled() {
    if (this.component.alwaysEnable) return false;

    return super.shouldDisabled;
  }

  set disabled(disabled) {
    this._disabled = disabled;
  }

  get disabled() {
    return !this.component.alwaysEnable && (this._disabled || this.parentDisabled);
  }
}

Formio.use({
  components: {
    snippet: SnippetComponent,
    directory: DirectoryComponent,
    button: CustomButtonComponent,
  },
});
