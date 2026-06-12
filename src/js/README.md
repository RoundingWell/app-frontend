# JS Guide

## Import Order

When importing dependencies we loosely follow some general rules and strictly follow others.
The canonical ordering list lives in [`/AGENTS.md`](../../AGENTS.md); this is the worked example.
```js
// 3rd party dependencies generally in order or "lowest-level" dependency
import { extend } from 'underscore'; // underscore is a dependency of marionette so it goes first.
import hbs from 'handlebars-inline-precompile'; // not really a dependency, but indirectly used by Marionette
import { View } from 'marionette';

// General css goes next before any local imports
import 'scss/modules/global.scss';

// Utilities
import funFormatter from 'js/utils/fun-formatter';

import intl from 'js/i18n';

// Base classes
import App from 'js/base/app';

// Entities and service modules
import { Model as PatientModel } from 'js/entities-service/entities/patients';

// Apps (typically alphabetically)
import ChildApp from 'js/apps/foo/child_app';
import LocalDepApp from './local_app';

// Other Mn classes in no particular order (there's usually not many)
import FooBehavior from 'js/behaviors/foo';
import FooRegion from 'js/regions/foo';
import FooComponent from 'js/components/foo';

// Views (typically alphabetically)
import { FooView, BarCollectionView }  from 'js/view/foo-bar/foo-bar_views';
import { LocalDepView } from './local_views';

// Large Templates (small templates are typically inlined with hbs``)
import FooTemplate from './foo.hbs';

// Local css
import './for-this-view.scss';
```


## Import Aliases

Rather than needing to import files relatively, by resource asset directories are aliased with vite.
The aliases can be found here: https://github.com/RoundingWell/app-frontend/blob/develop/vite.config.js

These aliases allow for any js file, no matter its location within the js directory to import like so:

```javascript
import { FooView } from 'js/views/some/foo_views';
```

## Underscore

- Use underscore over native or jQuery

We currently default to underscore API across the board. There are many APIs that have been native for a decade that are replicated in underscore that have small niceties or shorthands added that are useful. This way we don't have to have a list of which functions we use natively and which we use from underscore and we don't have multiple implementations of the functionality throughout the codebase. For the most part all data manipulation documentation can be traced to a single source.

## Marionette

- Render and attach as many things to a view as possible before showing utilizing toolkit app's `setView` -> `showChildView` -> `showView` pattern.
- Always use the `ui` hash when possible. If not possible use the locally scoped `$` `view.$()`. Do not query jQuery from the global `$`.
- Use `onDomRender`/`onDomRemove` when adding things to a view's contents.
- Use `onAttach`/`onDetach` when adding things to a view's `el`.
- Prefer `triggerMethod` over `trigger`.
- Prefer View `triggers` over View `events`.

### Trigger and Event Names

All trigger and event names should be wrapped in `''`.

Incorrect way:

```javascript
trigger:something:happened: this.onSomethingHappened
```

Correct way:

```javascript
'trigger:something:happened': this.onSomethingHappened
```

Events should alway indicate something that happened and not an action to take.
Ideally named `verb:name` like `click:fooButton` or sometimes `context:verb:name` like `state:change:foo`.
Ideally handlers also indicate handling the event rather than a specific action.
Particularly if an event handler does more than one thing.

## Object Keys

Should not be wrapped in `''`. For example:

Incorrect way:

```javascript
const x = {
  'foo':'bar',
  'bar':'foo'
};
```

Correct way:

```javascript
const y = {
  foo: 'bar',
  bar: 'foo'
};
```

> Note: Our linter currently cannot lint this.

## General Best Practices

- Prefer `const` to `let`.  No `var`!
- Only use destructuring when it clarifies the code.
- Use => functions for setting context when possible.  Note that arrow functions do not have an `arguments` variable.

- [Favor object composition over class inheritance](https://medium.com/javascript-scene/10-interview-questions-every-javascript-developer-should-know-6fa6bdf5ad95#.haauzmicp)
- [Writing Efficient Javascript](http://archive.oreilly.com/pub/a/server-administration/excerpts/even-faster-websites/writing-efficient-javascript.html) (Hint use [underscorejs](underscorejs.org)).
- [Decoupling with pub/sub](https://msdn.microsoft.com/en-us/magazine/hh201955.aspx)  (Hint use [Backbone.Radio](https://github.com/marionettejs/backbone.radio)).
- [Reducing Complexity by Refactoring with Guard Clauses](http://there4.io/2015/06/10/refactoring-with-guard-clauses-php-javascript/)
