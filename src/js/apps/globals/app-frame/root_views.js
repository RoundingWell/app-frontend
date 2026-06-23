import { extend, noop, partial } from 'underscore';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView, Region } from 'marionette';

import px from 'js/utils/formatting/px';

import 'scss/modules/fill-window.scss';

import PreloadRegion from 'js/regions/preload_region';
import TopRegionBehavior from 'js/behaviors/top-region';

import { PreloaderView } from 'js/auth/prelogin/prelogin_views';

import './app-frame.scss';
import './tooltip.scss';

const userActivityCh = Radio.channel('user-activity');
const historyCh = Radio.channel('history');

function preventRegionClose() {
  return this.getRegion('region').hasView();
}

const AppView = View.extend({
  className: 'app-frame',
  template: hbs`
    <div class="app-frame__nav js-nav" data-nav-region></div>
    <div class="app-frame__content flex-region" data-content-region></div>
    <div class="app-frame__sidebar" data-app-sidebar-region></div>
  `,
  ui: {
    nav: '.js-nav',
  },
  regions: {
    nav: '[data-nav-region]',
    content: {
      el: '[data-content-region]',
      regionClass: PreloadRegion,
    },
    sidebar: '[data-app-sidebar-region]',
  },
  toggleNav(shouldShow) {
    this.ui.nav.toggleClass('is-hidden', !shouldShow);
  },
});

const TopRegionView = View.extend({
  behaviors: [TopRegionBehavior],
  regionClass: Region.extend({ replaceElement: true }),
  template: hbs`<div data-region></div>`,
  regions: {
    region: '[data-region]',
  },
  contains(target) {
    const region = this.getRegion('region');
    if (region.hasView() && (region.currentView.el === target || this.Dom.hasEl(region.currentView.el, target))) return true;
    if (this.ignoreEl === target) return true;
    if (this.ignoreEl && this.Dom.hasEl(this.ignoreEl, target)) return true;
  },
  empty() {
    this.region.empty();
  },
});

const OverlayRegionView = TopRegionView.extend({
  className: 'fill-window',
  behaviors: [],
});

const PreloaderRegionView = TopRegionView.extend({
  // NOTE: ensures preload can't close on user click
  contains: preventRegionClose,
  onRender() {
    this.showChildView('region', new PreloaderView());
  },
});

const ModalRegionView = TopRegionView.extend({
  className: 'fill-window--dark',
  behaviors: [{
    behaviorClass: TopRegionBehavior,
    className: 'is-shown',
  }],
  initialize(options) {
    this.mergeOptions(options, ['$body', 'setLocation', 'contains']);
    this.region = this.getRegion('region');

    const hotkeyCh = Radio.channel('hotkey');
    this.listenTo(hotkeyCh, 'close', this.empty);
  },
  onRegionShow() {
    this.listenTo(historyCh, 'change:route', this.empty);
    this.listenTo(userActivityCh, 'window:resize', this.setLocation);
    this.setLocation();
  },
  onRegionEmpty() {
    this.stopListening(userActivityCh);
  },
  setLocation() {
    const view = this.region.currentView;
    const width = view.$el.outerWidth();
    const height = view.$el.outerHeight();
    const bodyHeight = this.$body.height();
    const bodyWidth = this.$body.width();

    const left = bodyWidth / 2 - width / 2;
    const top = bodyHeight / 3 - height / 3;

    view.$el.css({
      left: px(left),
      top: px(top),
    });
  },
  contains(target, testView) {
    if (!this.region.hasView()) return false;

    const el = this.region.currentView.el;

    // testView prevents closing layers below
    if (el === target || this.Dom.hasEl(el, target) || this !== testView) return true;
  },
});

const popDefaults = {
  align: 'left',
  direction: 'down',
  left: 0,
  outerHeight: 0,
  outerWidth: 0,
  popWidth: null,
  top: 0,
  windowPadding: 5,
};

const PopRegionView = TopRegionView.extend({
  initialize({ $body }) {
    this.region = this.getRegion('region');
    this.$body = $body;
    const hotkeyCh = Radio.channel('hotkey');
    this.listenTo(hotkeyCh, 'close', this.empty);
  },
  onRegionShow(region, view, options) {
    view.$el.addClass('app-frame__pop-region');
    const popOptions = extend({}, popDefaults, options);
    this.ignoreEl = options.ignoreEl;
    this.listenTo(userActivityCh, 'window:resize', this.empty);
    this.listenTo(historyCh, 'change:route', this.empty);
    this.listenTo(view, 'render render:children', partial(this.setLocation, popOptions));
    this.setLocation(popOptions);
  },
  onRegionEmpty(region, view) {
    view.$el.removeClass('app-frame__pop-region');
    this.stopListening(userActivityCh);
    this.stopListening(historyCh);
    this.stopListening(view);
  },
  setLocation(popOptions) {
    const view = this.region.currentView;

    if (popOptions.popWidth) {
      view.$el.css({
        width: px(popOptions.popWidth),
      });
    }

    const height = view.$el.outerHeight();
    const top = this.setDirection(height, popOptions);
    const width = popOptions.popWidth || view.$el.outerWidth();
    const left = this.setAlign(width, popOptions);

    view.$el.css({
      top: px(top),
      left: px(left),
    });
  },
  setAlign(width, { left, align, windowPadding, outerWidth }) {
    if (align === 'right') left += outerWidth - width;
    if (left < windowPadding) return windowPadding;

    const bodyWidth = this.$body.width();
    if (left + width > bodyWidth - windowPadding) {
      return bodyWidth - width - windowPadding;
    }
    return left;
  },
  /* istanbul ignore next: difficult to test in context */
  setDirection(height, { top, direction, windowPadding, outerHeight }) {
    const bodyHeight = this.$body.height();

    if (direction === 'down') {
      if (top + outerHeight + height + windowPadding > bodyHeight) {
        direction = 'forceUp';
        return this.setDirection(height, { top, direction, windowPadding, outerHeight });
      }

      return outerHeight + top;
    }

    top -= height;
    if (top >= windowPadding) return top;

    if (direction === 'forceUp') {
      return bodyHeight - windowPadding - height;
    }

    direction = 'down';
    return this.setDirection(height, { top, direction, windowPadding, outerHeight });
  },
});

const TooltipRegionView = TopRegionView.extend({
  initialize({ $body }) {
    this.region = this.getRegion('region');
    this.$body = $body;
  },
  onRegionShow(region, view, options) {
    this.listenTo(userActivityCh, 'window:resize', this.empty);

    this.ignoreEl = options.ignoreEl;

    if (options.orientation === 'horizontal') {
      this.setHorizontalLocation(options);
      return;
    }

    this.setVerticalLocation(options);
  },
  onRegionEmpty() {
    this.stopListening(userActivityCh);
  },
  addClass(className) {
    const view = this.region.currentView;
    view.$el.addClass(className);
  },
  setTop(top) {
    const view = this.region.currentView;
    view.$el.css({ top: px(top) });
  },
  setLeft(left) {
    const view = this.region.currentView;
    view.$el.css({ left: px(left) });
  },
  setHorizontalLocation({ left, top, outerWidth, outerHeight }) {
    const view = this.region.currentView;
    const leftPer = (left + outerWidth) / this.$body.width();
    const topPer = (top + outerHeight / 2) / this.$body.height();

    // top 25% of screen
    if (topPer < 0.25) {
      this.addClass('is-top');
      this.setTop(top + outerHeight / 2);
    // bottom 25% of screen
    } else if (topPer > 0.75) {
      this.addClass('is-bottom');
      this.setTop(top + outerHeight / 2 - view.$el.outerHeight());
    } else {
      this.setTop(top - view.$el.outerHeight() / 2 + outerHeight / 2);
    }

    // left 60% of screen
    if (leftPer > 0.6) {
      this.addClass('is-right-arrow');
      this.setLeft(left - view.$el.outerWidth());
    // right 40% of screen
    } else {
      this.addClass('is-left-arrow');
      this.setLeft(left + outerWidth);
    }
  },
  setVerticalLocation({ left, top, outerWidth, outerHeight }) {
    const view = this.region.currentView;
    const leftPer = (left + outerWidth / 2) / this.$body.width();
    const topPer = (top + outerHeight) / this.$body.height();

    // left 15% of screen
    if (leftPer < 0.15) {
      this.addClass('is-left');
      this.setLeft(left + outerWidth / 2);
    // right 15% of screen
    } else if (leftPer > 0.85) {
      this.addClass('is-right');
      this.setLeft(left + outerWidth / 2 - view.$el.outerWidth());
    } else {
      this.setLeft(left - view.$el.outerWidth() / 2 + outerWidth / 2);
    }

    // bottom 40% of screen
    if (topPer > 0.6) {
      this.addClass('is-bottom-arrow');
      this.setTop(top - view.$el.outerHeight());
    // top 60% of screen
    } else {
      this.addClass('is-top-arrow');
      this.setTop(top + outerHeight);
    }
  },
});

const RootView = CollectionView.extend({
  viewComparator: false,
  el: '#root',
  template: hbs``,
  AppView: AppView,
  initialize() {
    // Render away any preexisting html
    this.render();
    this.regions = [];
    const $body = this.$el;

    Radio.reply('top-region', 'contains', this.contains, this);

    this.appView = new this.AppView();

    // Add lowest layer (z-index) to highest
    this.addChildView(this.appView);
    this.addRegionView('tooltip', new TooltipRegionView({ $body }));
    this.addRegionView('modalSidebar', new ModalRegionView({ $body, setLocation: noop }));
    this.addRegionView('modal', new ModalRegionView({ $body }));
    this.addRegionView('modalSmall', new ModalRegionView({ $body }));
    this.addRegionView('modalLoading', new ModalRegionView({ $body, contains: preventRegionClose }));
    this.addRegionView('alert', new TopRegionView());
    this.addRegionView('pop', new PopRegionView({ $body }));
    this.addRegionView('overlay', new OverlayRegionView());
    this.addRegionView('preloader', new PreloaderRegionView());
    this.addRegionView('error', new TopRegionView());
  },
  addRegionView(name, view) {
    view.name = name;
    this.addChildView(view);
    this.regions[name] = view.getRegion('region');
  },
  getRegion(name) {
    return this.regions[name];
  },
  contains(testView, target) {
    const viewIndex = this.children.findIndexByView(testView);

    // Tests to see if a click is registered on a higher layer
    for (let i = this.children.length - 1; viewIndex <= i; i--) {
      const view = this.children.findByIndex(i);
      if (view.contains(target, testView)) return true;
    }
  },
});

export {
  RootView,
};
