# Sass Guide

Styles are linted by `npm run lint` and in CI.

## JavaScript Selectors

A selector that is used only for JavaScript logic

`.js-*`

_Examples:_
* `.js-open`
* `.js-needs-attention`

```html
<button class="btn js-submit">Submit</button>
```

## State Selector

Shared by Sass and JavaScript and/or Handlebars. Prefer an explicit BEM modifier for component styling and keep state classes as behavior hooks. When a state class must carry styles, scope it to its owning block rather than styling it globally.

`.is-*`
`.has-*`

_Examples:_
* `.is-selected`
* `.has-error`

```sass
.btn {
  background-color: red;
}

.btn--active {
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.25);
}
```

## BEM Style Selector

Block, Element, Modifier. Write complete, flat class names so markup classes can be searched verbatim in SCSS. Do not construct elements or modifiers with `&__` or `&--`. Keep selectors shallow and prefer a new BEM class over increasing specificity.

_Examples:_
* `.list`
* `.list__heading`
* `.list__heading--small`
* `.list__heading--large`
* `.list__heading--all-caps`


```html
<ul class="list">
  <li class="list__item">
    <h2 class="list__heading">Heading</h2>
    <h3 class="list__heading list__heading--small">Smaller Heading</h3>
    <p class="list__text">And a complete sentence.</p>
  </li>
  <li class="list__item"></li>
  <li class="list__item"></li>
</ul>
```

* http://csswizardry.com/2013/01/mindbemding-getting-your-head-round-bem-syntax/
* http://csswizardry.com/2015/03/more-transparent-ui-code-with-namespaces/
* https://medium.com/fed-or-dead/battling-bem-5-common-problems-and-how-to-avoid-them-5bbd23dee319#.o4u2vqr11

## Sass

### Spacing and geometry

Use 4px multiples for layout sizes, spacing, and offsets. Borders may use 1px or 0.5px. The established type and icon scales are intentional exceptions; document any other optical or geometry exception beside the declaration.

Within a rule set, declarations should be ordered as follows:

* @extend
* properties


```sass
.element {
  $scoped-variable: whatever;
  @extend .other-element;
  property: value;
}

.element:hover {
  /* styles here */
}

.element__child {
  /* styles here */
}
```

## Comment Levels
```sass
// *************************************
//
//   First Level
//   -> Description
//
// *************************************

// -------------------------------------
//   Second Level
// -------------------------------------

// ----- Third Level ----- //

// Fourth Level
```

## Using @extend
`@extend` should only be used within a single file.

## Sass Compiling

Sass modules are imported via vite and compiled into css so the sass dependency order is decided by vite.

## Sass Organization

### `core/`

This directory includes generic classes that are used throughout the app.
This generally entails overrides, utility classes and generic layout helpers

All of the core sass are partials and imported in the `provider-core.scss`.

### `domain/`

Domain Sass includes product-specific styles intentionally shared across multiple app domains.
Styles shared only within one domain belong under that domain's `../js/apps/<domain>/shared` directory.
Styles owned by one app belong directly beside that app.

### `modules/`

Modules sass includes styles that are generic and could be used to create any application that are not specific to the business of RoundingWell.
These are generally modules that are reused (or likely will be) by multiple js files in the app.

### Colocated app Sass

Styles that are specific to a certain set of views are defined in SCSS files in the same app folder as the `_views.js` file.
This allows us to easily understand when styles can be removed. No style in one of these files should be used outside of
the related js/hbs files. If a style should be reused it should move to `domain/` or `modules/` appropriately.

### Module ownership

A stylesheet may style only classes owned by its BEM block. Do not reach into another block with a descendant or compound selector. Compose module classes in the markup, add an owning modifier, or expose CSS custom properties when one module needs to configure another.

The shared `.icon` class is the explicit exception: an owning block may scope icon size, color, and alignment to its own elements.

### `provider-variables.scss`

Because of the way Vite compiles Sass, globally defined Sass variables need to be defined in this file.
It contains the legacy color maps and color variables. New V6 theme values are CSS custom properties in `core/_tokens.scss`.

## Icons

Care Ops renders SVG icons with hidden `<symbol>` definitions and same-document `<use>` references from the `{{fa}}`, `{{fas}}`, `{{far}}`, `{{fal}}`, and `{{fat}}` helpers.

App icons are listed in `packages/care-ops-fontawesome/manifest.json` and inlined into `index.html`. Customer/shared icon bundles served from `/icons/icons.js` are owned by `customer-assets`.
