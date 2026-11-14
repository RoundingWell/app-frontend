import { View } from 'marionette';

import intl from 'js/i18n';
import LayoutTemplate from './layout.hbs';

import './messages.scss';

export const MessagesView = View.extend({
  className: 'messaging-history',
  attributes: { 'aria-busy': 'true' },
  template: LayoutTemplate,
  regions: { history: '[data-history-region]', composer: '[data-composer-region]', recovery: '[data-recovery-region]' },
  ui: {
    history: '[data-history-region]', viewport: '.js-viewport', date: '.js-visible-date', status: '.js-status', earlier: '.js-earlier', beginning: '.js-beginning',
    composer: '[data-composer-region]', latest: '.js-latest',
  },
  triggers: { 'click @ui.earlier': 'load:older', 'click @ui.latest': 'click:latest' },
  templateContext() {
    return { copy: intl.patients.messaging };
  },
  onAttach() {
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        this.sizeHistory();
        if (this.followingLatest) this.scrollLatest();
      });
    });
    this.resizeObserver.observe(this.getUI('history')[0]);
    this.resizeObserver.observe(this.getUI('viewport')[0]);
    this.resizeObserver.observe(this.getUI('composer')[0]);
    this.resizeObserver.observe(this.getOption('viewport'));
  },
  onBeforeDetach() {
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.resizeFrame);
  },
  sizeHistory() {
    const outer = this.getOption('viewport');
    const viewport = this.getUI('viewport')[0];
    // A narrow screen scrolls the action header away when focusing the thread;
    // do not reserve that offscreen header inside the reading area as well.
    const offset = outer.clientWidth <= 560 ? 0 : this.el.getBoundingClientRect().top - outer.getBoundingClientRect().top + outer.scrollTop;
    const available = outer.clientHeight - offset - 16;
    const minimum = this.el.clientHeight - viewport.clientHeight + 120;
    const height = Math.max(minimum, Math.min(760, Math.floor(available)));
    if (Math.abs(this.el.clientHeight - height) < 2) return;
    this.el.style.setProperty('--messaging-history-height', `${ height }px`);
  },
  stopFollowingLatest() {
    this.followingLatest = false;
  },
  scrollLatest() {
    const viewport = this.getUI('viewport')[0];
    viewport.scrollTop = viewport.scrollHeight;
  },
  showStatus(text) {
    this.getUI('status')[0].textContent = text;
  },
  setBusy(busy) {
    this.el.setAttribute('aria-busy', String(busy));
  },
  setWindow(hasOlder, date) {
    this.getUI('earlier')[0].hidden = !hasOlder;
    this.getUI('beginning')[0].hidden = hasOlder;
    this.getUI('date')[0].textContent = date;
  },
  focusLatest() {
    this.followingLatest = true;
    this.sizeHistory();
    this.scrollLatest();
    this.getUI('composer')[0].scrollIntoView({ block: 'end' });
  },
});
