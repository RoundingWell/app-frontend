import { Application } from "marionette";
function constructRouteApplication(options) {
  let unmount;
  this.on("before:destroy", () => unmount?.());
  Application.call(this, options);
  if (this.isDestroyed()) {
    return;
  }
  const router = this.getOption("router");
  if (!router || typeof router.mount !== "function") {
    throw new TypeError("RouteApplication requires a router");
  }
  const routes = this.getOption("routes");
  const definitions = typeof routes === "function" ? routes.call(this) : routes;
  if (this.isDestroyed()) {
    return;
  }
  const parent = this.getOption("routeParent");
  unmount = router.mount(definitions, { parent, controller: this, owner: this });
  if (this.isDestroyed()) {
    unmount();
  }
}
const RouteApplication = Application.extend({
  constructor: constructRouteApplication,
  routes: {}
}, {
  // Configure the shared engine before defining declarative child constructors.
  // Ordinary Application options still permit an explicit per-instance override.
  withRouter(router) {
    return RouteApplication.extend({ router });
  }
});
export {
  RouteApplication
};
