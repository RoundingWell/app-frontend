import Backbone from 'backbone';
import { View } from 'marionette';

import intl from 'js/i18n';
import { HistoryListView } from './history_views';
import LayoutTemplate from './layout.hbs';

import './messages.scss';

export const MessagesView = View.extend({
  className: 'messaging-history',
  attributes: { 'aria-busy': 'true' },
  template: LayoutTemplate,
  regions: { history: '[data-history-region]' },
  ui: {
    history: '[data-history-region]', viewport: '.js-viewport', date: '.js-visible-date', status: '.js-status', earlier: '.js-earlier', beginning: '.js-beginning',
    latest: '.js-latest',
  },
  triggers: { 'click @ui.earlier': 'load:older', 'click @ui.latest': 'click:latest' },
  childViewTriggers: { 'navigate:action': 'navigate:action', 'navigate:flow': 'navigate:flow' },
  templateContext() {
    return { copy: intl.patients.messaging };
  },
  onRender() {
    const copy = intl.patients.messaging;
    this.showChildView('history', new HistoryListView({
      collection: new Backbone.Collection(), patient: this.getOption('patient'), currentActionId: this.getOption('currentActionId'),
      labels: { sms: copy.sms, showMore: copy.showMore },
    }));
  },
  onAttach() {
    const viewport = this.getUI('viewport')[0];
    this.lastScrollTop = viewport.scrollTop;
    this.scrollListener = () => this.onViewportScroll();
    viewport.addEventListener('scroll', this.scrollListener, { passive: true });
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        this.sizeHistory();
        if (this.followingLatest) this.scrollLatest();
      });
    });
    this.resizeObserver.observe(this.getUI('history')[0]);
    this.resizeObserver.observe(this.getUI('viewport')[0]);
    this.resizeObserver.observe(this.getOption('viewport'));
  },
  onBeforeDetach() {
    this.getUI('viewport')[0].removeEventListener('scroll', this.scrollListener);
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.resizeFrame);
    cancelAnimationFrame(this.startFrame);
  },
  onBeforeDestroy() {
    cancelAnimationFrame(this.startFrame);
  },
  startHistory(focusOnLoad) {
    this.startFrame = requestAnimationFrame(() => {
      this.followingLatest = true;
      this.scrollLatest();
      if (focusOnLoad) this.focusLatest();
      this.triggerMethod('ready:history');
    });
  },
  renderHistory(models, hasOlder) {
    const list = this.getChildView('history');
    const viewport = this.getUI('viewport')[0];
    const anchor = list.captureAnchor(viewport);
    list.collection.set(models);
    this.hasOlder = hasOlder;
    this.showStatus(models.length ? '' : intl.patients.messaging.empty);
    if (this.followingLatest) this.scrollLatest();
    else {
      list.restoreAnchor(anchor, viewport);
      this.lastScrollTop = viewport.scrollTop;
    }
    this.updateWindow();
  },
  onViewportScroll() {
    const viewport = this.getUI('viewport')[0];
    const upward = viewport.scrollTop < this.lastScrollTop;
    this.lastScrollTop = viewport.scrollTop;
    if (upward && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > 5) this.stopFollowingLatest();
    if (upward && !this.followingLatest && this.getChildView('history').nearBeginning(viewport)) this.triggerMethod('load:older');
    this.updateWindow();
  },
  updateWindow() {
    this.setWindow(this.hasOlder, this.getChildView('history').currentDay(this.getUI('viewport')[0]));
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
    this.lastScrollTop = viewport.scrollTop;
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
    this.el.scrollIntoView({ block: 'nearest' });
  },
});
