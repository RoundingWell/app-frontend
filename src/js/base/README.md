# Base

This directory houses the base libraries that the rest of the application uses as its foundation.
We extend some libraries with custom functionality specifically for our unique application uses.
Additionally there are some modules here that are fairly generic and could be extracted as a 3rd party lib.
The files here are the building blocks and configuration for building a complex app and should be more than a utility.

## Routing

The `@mnjs/router` Router (`src/js/router.js`) and the static route tree
(`src/js/routes.js`) drive URL routing; area and page Apps select their children with
`RouteOutlet`. See [routing.md](./routing.md) before changing routing infrastructure or
application route definitions.
