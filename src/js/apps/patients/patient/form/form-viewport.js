import Radio from 'backbone.radio';
import { Behavior } from 'marionette';

const FRAME_BOTTOM_OVERFLOW = 8;
const FRAME_MIN_HEIGHT = 320;
const FRAME_TOP_GAP = 16;
const HEIGHT_JITTER = 2;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const userActivityCh = Radio.channel('user-activity');

export default Behavior.extend({
  ui: {
    header: '[data-form-viewport-header]',
  },
  onInitialize() {
    this.isExpanded = !!this.view.getOption('isExpanded');
    this.viewportView = this.view.getOption('viewportView');
    if (!this.viewportView) throw new Error('FormViewportBehavior requires a viewport view');

    this.channel = Radio.channel(`form${ this.view.model.id }`);
  },
  onAttach() {
    this.channel.reply('form:interact', this.onFormInteract, this);
    this.listenTo(userActivityCh, 'window:resize', this.scheduleFrameSizing);
    this.listenTo(this.view.getRegion('widgets'), 'show', this.onChangeWidgetsView);
    this.startResizeObserver();
    this.applyFrameSizing();
  },
  onBeforeDetach() {
    this.channel.stopReplying('form:interact', this.onFormInteract, this);
    this.stopListening(userActivityCh, 'window:resize', this.scheduleFrameSizing);
    this.stopListening(this.view.getRegion('widgets'), 'show', this.onChangeWidgetsView);
    this.resizeObserver?.disconnect();
    this.clearScheduledSizing();
    this.clearFrameSizing();
  },
  onChangeFormView() {
    if (!this.view.isAttached()) return;

    this.refreshFrameSizing();
  },
  onChangeWidgetsView() {
    if (!this.view.isAttached()) return;

    this.refreshFrameSizing();
  },
  refreshFrameSizing() {
    this.resizeObserver?.disconnect();
    this.clearScheduledSizing();
    this.currentHeight = null;
    this.startResizeObserver();
    this.applyFrameSizing();
  },
  onChangeExpanded(isExpanded) {
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
  getFormView() {
    return this.view.getRegion('form').currentView;
  },
  applyFrameSizing() {
    if (this.isExpanded) return;

    const formView = this.getFormView();
    const frameHeight = this.view.el.getBoundingClientRect().height;
    const iframeHeight = formView.getViewportHeight();
    const frameChromeHeight = Math.max(0, frameHeight - iframeHeight);
    const { height: viewportHeight } = this.viewportView.getViewportMetrics();
    const nextHeight = Math.max(
      FRAME_MIN_HEIGHT,
      Math.floor(
        viewportHeight
        - frameChromeHeight
        - FRAME_TOP_GAP
        + FRAME_BOTTOM_OVERFLOW,
      ),
    );

    if (
      this.currentHeight != null
      && Math.abs(this.currentHeight - nextHeight) < HEIGHT_JITTER
    ) return;

    formView.setViewportHeight(nextHeight);
    this.currentHeight = nextHeight;
  },
  clearFrameSizing() {
    this.getFormView()?.clearViewportHeight();
    this.currentHeight = null;
  },
  startResizeObserver() {
    if (!window.ResizeObserver) return;

    this.resizeObserver = new window.ResizeObserver(() => this.scheduleFrameSizing());
    [
      this.viewportView.getViewportElement(),
      this.ui.header[0],
      this.getWidgetsElement(),
    ].forEach(element => this.resizeObserver.observe(element));
  },
  getWidgetsElement() {
    const widgetsRegion = this.view.getRegion('widgets');
    return widgetsRegion.currentView?.el || this.view.el.querySelector('[data-widgets-header-region]');
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
    const { top: viewportTop } = this.viewportView.getViewportMetrics();
    const frameTop = this.view.el.getBoundingClientRect().top;

    return Math.abs(frameTop - viewportTop - FRAME_TOP_GAP) <= HEIGHT_JITTER;
  },
  snapToTop() {
    const { scrollTop, top: viewportTop } = this.viewportView.getViewportMetrics();
    const frameTop = this.view.el.getBoundingClientRect().top;
    const targetTop = scrollTop
      + frameTop
      - viewportTop
      - FRAME_TOP_GAP;

    this.viewportView.scrollViewportTo({
      behavior: window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ? 'auto' : 'smooth',
      top: Math.max(0, targetTop),
    });
  },
});
