import { isEmpty, omit } from 'underscore';
import Backbone from 'backbone';

const LAYOUT_INPUTS = [
  'isFocusWithin',
  'isHovering',
  'isNarrow',
  'isNavDroplistOpen',
  'isTouchDrawerOpen',
  'temporaryMinimized',
  'userMinimized',
];

const LAYOUT_EVENTS = LAYOUT_INPUTS.map(attribute => `change:${ attribute }`).join(' ');

function getLayout(attributes) {
  const isMinimized = Boolean(
    attributes.userMinimized
    || attributes.temporaryMinimized
    || attributes.isNarrow,
  );
  const hasOverlayReason = Boolean(
    attributes.isHovering
    || attributes.isFocusWithin
    || attributes.isTouchDrawerOpen
    || attributes.isNavDroplistOpen,
  );

  return {
    isFullNavVisible: !isMinimized || hasOverlayReason,
    isMinimized,
  };
}

const StateModel = Backbone.Model.extend({
  defaults: {
    canPatientCreate: false,
    currentApp: null,
    selectedNav: null,

    // Derived, view-facing layout state (what the nav views render).
    isFullNavVisible: true,
    isMinimized: false,

    // Inputs to the layout reducer. isNarrow is the responsive viewport
    // breakpoint; userMinimized/temporaryMinimized are user intent; the
    // remaining flags are each a reason a minimized nav should stay expanded
    // as an overlay. Not rendered directly — updateLayout() projects them into
    // the fields above.
    isFocusWithin: false,
    isHovering: false,
    isNarrow: false,
    isNavDroplistOpen: false,
    isTouchDrawerOpen: false,
    temporaryMinimized: false,
    userMinimized: false,
  },
  initialize() {
    this.on(LAYOUT_EVENTS, this.updateLayout);
    this.updateLayout({ silent: true });
  },
  updateLayout(model, value, options) {
    const setOptions = model === this ? options : model;
    if (setOptions?.unset && isEmpty(this.attributes)) return this;

    const layoutOptions = setOptions?.unset ? omit(setOptions, 'unset') : setOptions;

    return Backbone.Model.prototype.set.call(this, getLayout(this.attributes), layoutOptions);
  },
  // Clear the transient overlay reasons so a minimized nav settles closed.
  closeOverlay() {
    this.set({
      isFocusWithin: false,
      isHovering: false,
      isNavDroplistOpen: false,
      isTouchDrawerOpen: false,
    });
  },
});

export default StateModel;
