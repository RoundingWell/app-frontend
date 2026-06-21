# Components

Components are a closed collection of state logic, views, and templates.
Ideally components are generic, terminal objects like datepickers or tooltips and are configured instead of extended.

## Testing

Generic components should be added to the `components/index.js` file so that they can be tested directly from within the build.
Component specs live beside the component as `*.component.cy.js`.
