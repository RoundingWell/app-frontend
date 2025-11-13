<img title="RoundingWell" src="https://camo.githubusercontent.com/a8c1c4b81171f74dc9d0e2c791c096e626901ac9/68747470733a2f2f67697463646e2e78797a2f7265706f2f526f756e64696e6757656c6c2f636172652d6f70732d66726f6e74656e642f366438343532643262663335376436663866623361353632373332646637643531616535373639312f7372632f6173736574732f696d616765732f726f756e64696e6777656c6c2d6c6f676f2e737667" width="300">

[![CircleCI](https://circleci.com/gh/RoundingWell/care-ops-frontend.svg?style=svg)](https://circleci.com/gh/RoundingWell/care-ops-frontend)
[![Coverage Status](https://coveralls.io/repos/github/RoundingWell/care-ops-frontend/badge.svg)](https://coveralls.io/github/RoundingWell/care-ops-frontend)
[![Cypress.io tests](https://img.shields.io/badge/cypress.io-tests-green.svg?style=flat-square)](https://dashboard.cypress.io/#/projects/ep9zr6/runs)

# Getting Started: Frontend

Documentation for the RoundingWell frontend can be found within `README.md` files throughout this repo.

## Dependencies & Installation

We use [npm](npmjs.com) for our package manager

### Node

You will need [Node.js](http://www.nodejs.org). It is recommended that devs [install nvm](https://github.com/creationix/nvm#install-script) the node version manager. NVM allows you to change node versions on the fly.

Once NVM is installed, activate the right Node version with:
```
$ nvm use
```

## Installing Project Dependencies

Then you will need to run
```
$ npm i
```

## Releasing

Releases are automated via an npm script.
Make a new temporary local branch consisting of the commits you want to release.
Then run
```
$ npm run release
```

It will automatically create a release branch on origin named `release/YYYYMMDD`
If that release branch already exists it will increment the branch name ie: `release/YYYYMMDD-1`
All dates are in UTC.

To make a release outside of this convention, pass it a branch name.
```
$ npm run release test-foo
```

This will create the branch `release/test-foo`

Release branches should _never_ get merged back into `develop`.
If a hotfix needs to be made to a release, the fix should ideally first be made to `develop` and picked into a new release.
The new release, if necessary, can be branched off of a previous release, whatever is easiest to compose a release branch containing only the commits desired.
In some situations some fixes must be applied differently to a release branch than to `develop`.  This is ok!  The commits specific to a release do not need to go back into `develop`.

Essentially this follows the release branches with [Gitlab flow](https://docs.gitlab.com/ee/topics/gitlab_flow.html#release-branches-with-gitlab-flow)

### Test Releases

Test releases are built with sourcemaps and follow the same pattern as a regular release.
Besides the build difference, the branch name will be `test/YYYYMMDD`.

These branches are useful for sharing to ship to dev sandboxes, and should not be used in production.

## Development

All development work should branch off of and PR into the `develop` branch.

### Setting Up Your Development Environment

#### Backend Setup

To develop against a remote AWS dev stack:

1. **Deploy your backend stack** (replace `stack` with your stack name, e.g., `john`):
   ```
   bin/console deploy:dev john
   ```

2. **After your first login**, prepare a clinician account:
   ```
   bin/remote stack console clinician:prepare your.email@roundingwell.com
   ```
   For example, if your stack name is `john`:
   ```
   bin/remote john console clinician:prepare john.doe@roundingwell.com
   ```

#### Frontend Setup

Create a `.env` file in the project root with your dev stack URL:
```
VITE_DEV_API_URL=https://stack.roundingwell.dev
```
Replace `stack` with your stack name (e.g., `https://john.roundingwell.dev`).

### Running the Development Server

There are two npm commands most useful for development:

Useful for local development with vite local dev-server and your remote dev stack (https://github.com/RoundingWell/care-ops-backend)
```
$ npm run dev
```

To develop in the [Cypress](cypress.io) gui:
```
$ npm test
```

Occasionally the vite server does not release the port, so dev-ing in either environment uses the wrong port and fails.
To fix this try:
```
$ npm stop
```
If this doesn't work try turning your computer off and then on again 😜

# Important Dependencies

- [Underscore](https://underscorejs.org/)
- [Backbone](https://backbonejs.org/)
- [Backbone.Radio](https://github.com/marionettejs/backbone.radio)
- [Marionette](https://marionettejs.com/)
- [Marionette.Toolkit](https://github.com/RoundingWellOS/marionette.toolkit)
  Toolkit adds the `App` class for an Application tree. Each `App` has a lifecycle and an attached state model.
  Apps are best for requesting data, packaging it and choosing the correct views to show.
  Toolkit also comes with `Component` for making generic encapsulated components such as datepickers or other widgets.
  In this program [Apps have been made async by default](https://github.com/RoundingWellOS/marionette.toolkit/blob/master/docs/async-app-start.md).

  A typical app will look like:

```js
const MyApp = Toolkit.App.extend({
  onBeforeStart(options) {
    this.setView(new MyLayoutView());
    this.showChildView('header', options.headerText);
    this.showView();
  },
  beforeStart() {
    return Radio.request('entities', 'data');
  },
  onStart(options, data) {
    this.showChildView('content', new DataView({ model: data }));
  }
});
```

`Components` should be configurable but not built to be extended. They can also act as a wrapper for 3rd party widgets such as jquery plugins.
A component controls a region and a view combined with a state model, providing a consistent API for interaction.

- [Backbone.Store](https://github.com/RoundingWellOS/backbone.store)
  A small but important library that ensures there is only a single instance of a model in memory. It is used for both server models and to sync state models across applications.

```js
const MyModel = Backbone.Model.extend({...});

const MyUniqueModel = Backbone.Store(MyModel);

const myUniqueModel = new MyUniqueModel({ id: '1', foo: 'bar' });
const sameModel = new MyUniqueModel({ id: '1' });
sameModel.get('foo') === 'bar'; // true

const nonUnique = new MyModel({ id: '1' });
nonUnique.get('foo') === 'bar'; // false
```

- [Store.js](https://github.com/marcuswestin/store.js#readme)
  A library for accessing localstorage across browsers

## Font Awesome

This project uses [Font Awesome Pro](https://fontawesome.com/how-to-use/on-the-web/setup/using-package-managers#installing-pro)
and should be setup globally to work with npm for devs. [Logging into the doc page](https://fontawesome.com/how-to-use/on-the-web/setup/using-package-managers#installing-pro) will provide the license needed.

Icons are loaded with subsetting. To use an icon with Font Awesome it needs to be set in `package.json`

```json
"fontawesome": {
  "far": ["check"],
  "fas": ["check"],
  "fal": ["acorn"]
},
```

The above example would make available solid and regular check and light acorn. To access the icon, use the following template helper:
```hbs
{{fas "check"}}
{{fal "acorn"}}
{{far "check"}}
```

## Templating and Styles

Handlebars templates and stylesheets should be imported directly into the modules they're used.
Handlebars can also be made inline using the ``hbs```` template literal

```javascript
import CompiledTemplate from './template-file.hbs';
import 'some-styles.scss';
const OtherTemplate = hbs`
  <div class="other-template">
    This multi-line template will be precompiled during the build process.
  </div>
`;
```

## Feature Flags

Feature Flags are intended to protect users from new code that isn't fully baked or to allow for gradual rollout.
Right now we have one flag for development purposes.

```javascript
if (_DEVELOP_) {
  // new code
}
```

### Using Feature Flags

Flags are best used such that a minimal amount of changes are made when the flag is being removed.

```javascript
// Bad
function foo() {
  if (flag) {
    doNew();
  } else {
    doOld();
  }
}

// Good
function foo() {
  if (!flag) {
    doOld();
    return;
  }
  doNew();
}
```

It also may be better to duplicate larger areas of code for fewer easier to remove flags.

```javascript
// Bad
function foo() {
  if (flag) foo();
  bar();
  baz();
  if (!flag) bazinga();
  quxx();
}

// Good
function foo() {
  if (!flag) {
    bar();
    baz();
    bazinga();
    quxx();
    return;
  }

  foo();
  bar();
  baz();
  quxx();
}
```

# Code Standards

Outside of linting there are some recommendations for code standards that will help in long term maintenance.
- SASS follows a general [BEM format](http://getbem.com/). Ideally do not make deep elements, but start a new block if additional descriptors are needed.
- [Favor object composition over class inheritance](https://medium.com/javascript-scene/10-interview-questions-every-javascript-developer-should-know-6fa6bdf5ad95#.haauzmicp)
- Within reason functions should ideally accomplish one task in less than 10 lines unless logically trivial. If it is getting to big, break up the function.
- Similarly modules should ideally get no larger than 300 lines or so. This is a general guideline and not a rule.
- Use only .js- prefixed selectors if at all possible from the code. Do not use style classes, ids, or tagnames if it can be avoided.
- Utilize the ui hash on views and avoid using the $el if possible. Never use $ directly within a view. Worst case use this.$el or this.$.
- The view should have say over only the DOM inside its own template or in the case of a CollectionView sometimes its direct children. Avoid allowing deep reaching within the DOM or anything external changing the DOM besides the view itself.
- Anything AJAX should happen within the entities service only.
- Generally it is better to store state on a state model than to append a property to an instance.
- Events and handlers should be named `verb:subject` or `context:verb:subject` based on what happened not what will happen ie:

```js
triggers: {
  'click .js-button1': 'show:modal' // bad
  'click .js-button2': 'click:button2' // good
},
childViewTriggers: {
  'click:button': 'button:clicked', // bad
  'click:button': 'listItem:click:button' //good
},
onShowModal() {
  console.log('The naming of this handler suggest a modal was just shown');
},
onClickButton2() {
  this.showModal(); // It's ok for a handler to simply call a single action
}
```

Use guards to handle the exception on functions when possible ie:

```js
// Good
doFoo(options) {
  if (!options.bar) {
    this.doSomethingElse();
    return;
  }

  return 'Foo:' + options.bar;
}

// Bad
doFoo(options) {
  if (options.bar) {
    return 'Foo:' + options.bar
  } else {
    this.doSomethingElse()
  }
}
```

# An Open Source Culture

It is our intention to open source by default.  Ideally any generic solution can be extracted, well documented, and tested.  Open sourcing encourages better code, collaboration with outside developers, and potentially free battle-testing, bugfixes and features from the public.
- [The Case for Open Source](https://opensource.org/advocacy/case_for_business.php)
- [The Culture of Open Source](https://www.thoughtworks.com/insights/blog/culture-open-source)

## Our Libraries

Libraries for public consumption are licensed with the [MIT License](https://opensource.org/licenses/MIT).

Currently our OS projects are available mainly at https://github.com/RoundingWellOS

Each project contains its own documentation for contributions.

## Other Libraries

Additionally we actively encourage contributing to other projects.  Don't know where to start?  Look at documentation or tests for any of the libraries we use.
