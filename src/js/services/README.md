# Services

Service classes that interface over a radio channel.

UI owned exclusively by a service lives in a directory matching the service module, such as `alert/`, `modal/`, or `sidebar/`.
Keep the service module at its existing public import path. Component and E2E specs live beside the service as
`*.component.cy.js` and `*.e2e.cy.js`.
