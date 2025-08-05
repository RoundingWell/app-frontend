# Copilot Instructions for RoundingWell Care Ops Frontend

## Key Architecture Decisions
- Marionette.js for view layer
- Backbone.js for models/collections
- Handlebars for templating
- SCSS with BEM methodology
- Vite for building
- Cypress for testing

## Common Patterns
- Views extend from base classes in `src/js/base/`
- Apps coordinate between views and entities
- All AJAX happens in entities-service
- State management via Backbone models

## File Naming Conventions
- Views: `*_views.js`
- Apps: `*_app.js`
- Templates: `*.hbs`
- Styles: `*.scss`

## Import Order
1. 3rd party libraries
2. CSS imports
3. Utilities and base classes
4. Apps
5. Views/components
6. Templates
7. Local CSS

## Domain Context
This is a healthcare application for care coordination and patient management. Common entities include:
- Patients, Actions, Forms, Flows
- Clinicians, Teams, Organizations
- Form responses, Workflows
- Care plans and patient engagement
