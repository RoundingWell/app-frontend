import { Behavior } from 'marionette';

export default Behavior.extend({
  events: { scroll: 'onScroll' },
  stateEvents: {
    'change:hasOlder change:hasNewer change:request change:retry': 'onPagingChange',
  },
  onScroll() {
    const top = this.el.scrollTop;
    this.direction = top < this.previousTop ? 'older' : 'newer';
    this.previousTop = top;
    this.checkEdges();
  },
  onAttach() {
    this.onScrollPosition();
    this.scheduleEdgeCheck();
  },
  onScrollPosition() {
    this.previousTop = this.el.scrollTop;
  },
  onScrollAdjust(offset) {
    this.el.scrollTop = Math.max(0, this.el.scrollTop + offset);
    this.view.triggerMethod('scroll:position');
  },
  onScrollLatest() {
    this.el.scrollTop = this.el.scrollHeight;
    this.view.triggerMethod('scroll:position');
  },
  onBeforeCommit() {
    this.position = { top: this.el.scrollTop, height: this.el.scrollHeight };
  },
  onAfterCommit({ prepend }) {
    const { top, height } = this.position;
    this.position = null;
    this.el.scrollTop = top + (prepend ? this.el.scrollHeight - height : 0);
    this.view.triggerMethod('scroll:position');
  },
  onPagingChange() {
    const { request, retry } = this.getState().attributes;
    cancelAnimationFrame(this.edgeFrame);
    if (!request && !retry) this.scheduleEdgeCheck();
  },
  onBeforeDetach() {
    cancelAnimationFrame(this.edgeFrame);
  },
  onBeforeDestroy() {
    cancelAnimationFrame(this.edgeFrame);
  },
  scheduleEdgeCheck() {
    cancelAnimationFrame(this.edgeFrame);
    this.edgeFrame = requestAnimationFrame(() => this.checkEdges());
  },
  checkEdges() {
    const { request, retry } = this.getState().attributes;
    if (!this.view.isAttached() || request || retry) return;
    const direction = this.getEdgeDirection();
    if (direction) this.view.triggerMethod('load:edge', direction);
  },
  getEdgeDirection() {
    const { hasOlder, hasNewer } = this.getState().attributes;
    const older = hasOlder && this.el.scrollTop <= 200;
    const newer = hasNewer && this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight <= 200;
    if (this.direction === 'older' && older) return 'older';
    if (newer) return 'newer';
    if (older) return 'older';
  },
});
