import Radio from 'backbone.radio';
import { Behavior } from 'marionette';

const FRAME_BOTTOM_OVERFLOW = 8;
const FRAME_TOP_GAP = 16;
const HEIGHT_JITTER = 2;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const SELECTORS = {
  frame: '[data-form-viewport-frame]',
  header: '[data-form-viewport-header]',
  iframe: '[data-form-viewport-iframe]',
  pane: '[data-form-viewport-scroll-container]',
  widgets: '[data-widgets-header-region]',
};

export default Behavior.extend({
  onInitialize() {
    this.isExpanded = !!this.view.getOption('isExpanded');
    this.channel = Radio.channel(`form${ this.view.model.id }`);
    this.onHeaderClick = this.onHeaderClick.bind(this);
    this.onWindowResize = this.scheduleFrameSizing.bind(this);
    this.listenTo(this.view, 'change:expanded', this.setExpanded);
  },
  onAttach() {
    this.frameEl = this.getRequiredClosest('frame', SELECTORS.frame);
    this.headerEl = this.getRequiredElement('header', this.frameEl, SELECTORS.header);
    this.paneEl = this.getRequiredClosest('scroll container', SELECTORS.pane);
    this.iframeEl = this.getRequiredElement('iframe', this.view.el, SELECTORS.iframe);

    this.channel.reply('form:interact', this.onFormInteract, this);
    this.headerEl.addEventListener('click', this.onHeaderClick);
    window.addEventListener('resize', this.onWindowResize);
    this.startResizeObserver();
    this.applyFrameSizing();
  },
  onBeforeDetach() {
    this.channel.stopReplying('form:interact', this.onFormInteract, this);
    this.headerEl?.removeEventListener('click', this.onHeaderClick);
    window.removeEventListener('resize', this.onWindowResize);
    this.resizeObserver?.disconnect();
    this.clearScheduledSizing();
    this.clearFrameSizing();
  },
  setExpanded(isExpanded) {
    const nextIsExpanded = !!isExpanded;
    if (this.isExpanded === nextIsExpanded) return;

    this.isExpanded = nextIsExpanded;
    if (this.isExpanded) {
      this.clearFrameSizing();
      return;
    }

    this.scheduleFrameSizing();
  },
  onFormInteract() {
    if (this.isExpanded || this.isFrameSnapped()) return;

    this.snapToTop();
  },
  onHeaderClick(event) {
    const interactiveControl = event.target.closest(
      'button, a, input, select, textarea, [role="button"], [role="link"], [contenteditable]',
    );
    if (interactiveControl) return;

    this.onFormInteract();
  },
  applyFrameSizing() {
    if (this.isExpanded) return;

    const frameHeight = this.frameEl.getBoundingClientRect().height;
    const iframeHeight = this.iframeEl.getBoundingClientRect().height;
    const frameChromeHeight = Math.max(0, frameHeight - iframeHeight);
    const nextHeight = Math.max(
      1,
      Math.floor(
        this.paneEl.clientHeight
        - frameChromeHeight
        - FRAME_TOP_GAP
        + FRAME_BOTTOM_OVERFLOW,
      ),
    );

    if (
      this.currentHeight != null
      && Math.abs(this.currentHeight - nextHeight) < HEIGHT_JITTER
    ) return;

    this.iframeEl.style.height = `${ nextHeight }px`;
    this.currentHeight = nextHeight;
  },
  clearFrameSizing() {
    this.iframeEl?.style.removeProperty('height');
    this.currentHeight = null;
  },
  startResizeObserver() {
    if (!window.ResizeObserver) return;

    this.resizeObserver = new window.ResizeObserver(this.onWindowResize);
    [
      this.paneEl,
      this.headerEl,
      this.frameEl.querySelector(SELECTORS.widgets),
    ].forEach(element => {
      if (element) this.resizeObserver.observe(element);
    });
  },
  scheduleFrameSizing() {
    if (this.isExpanded || this.frameSizingFrame != null) return;

    this.frameSizingFrame = window.requestAnimationFrame(() => {
      this.frameSizingFrame = null;
      this.applyFrameSizing();
    });
  },
  clearScheduledSizing() {
    if (this.frameSizingFrame != null) {
      window.cancelAnimationFrame(this.frameSizingFrame);
    }
    this.frameSizingFrame = null;
  },
  isFrameSnapped() {
    const paneTop = this.paneEl.getBoundingClientRect().top;
    const frameTop = this.frameEl.getBoundingClientRect().top;

    return Math.abs(frameTop - paneTop - FRAME_TOP_GAP) <= HEIGHT_JITTER;
  },
  snapToTop() {
    const paneTop = this.paneEl.getBoundingClientRect().top;
    const frameTop = this.frameEl.getBoundingClientRect().top;
    const targetTop = this.paneEl.scrollTop
      + frameTop
      - paneTop
      - FRAME_TOP_GAP;

    this.paneEl.scrollTo({
      behavior: window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ? 'auto' : 'smooth',
      top: Math.max(0, targetTop),
    });
  },
  getRequiredClosest(name, selector) {
    const element = this.view.el.closest(selector);

    if (!element) throw new Error(`FormViewportBehavior requires a ${ name } matching ${ selector }`);

    return element;
  },
  getRequiredElement(name, root, selector) {
    const element = root.querySelector(selector);

    if (!element) throw new Error(`FormViewportBehavior requires a ${ name } matching ${ selector }`);

    return element;
  },
});
