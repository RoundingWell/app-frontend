import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import StartupTemplate from './startup.hbs';

import './startup.scss';

const revealDelay = 550;
const minimumVisibleTime = 200;
const exitDuration = 160;

const StartupView = View.extend({
  className: 'startup fill-window',
  attributes: {
    'aria-atomic': 'true',
    'aria-busy': 'true',
    'role': 'status',
  },
  template: StartupTemplate,
  triggers: {
    'click .js-retry': 'click:retry',
  },
  ui: {
    error: '.js-error',
    loading: '.js-loading',
    retry: '.js-retry',
  },
  initialize(options = {}) {
    this.reload = options.reload || (() => window.location.reload());
  },
  onRender() {
    this.revealTimer = setTimeout(() => this.reveal(), revealDelay);
  },
  reveal() {
    this.revealTimer = null;
    this.revealedAt = Date.now();
    this.$el.addClass('is-visible');
  },
  dismiss() {
    if (this.dismissTimer || this.exitTimer) return;

    clearTimeout(this.revealTimer);

    if (!this.revealedAt) {
      this.destroy();
      return;
    }

    const visibleTime = Date.now() - this.revealedAt;
    const remainingVisibleTime = Math.max(minimumVisibleTime - visibleTime, 0);

    this.dismissTimer = setTimeout(() => this.startExit(), remainingVisibleTime);
  },
  startExit() {
    this.dismissTimer = null;
    this.$el
      .attr('aria-busy', 'false')
      .addClass('is-exiting');
    this.exitTimer = setTimeout(() => this.destroy(), exitDuration);
  },
  showError() {
    clearTimeout(this.revealTimer);
    clearTimeout(this.dismissTimer);
    clearTimeout(this.exitTimer);
    this.revealTimer = null;
    this.dismissTimer = null;
    this.exitTimer = null;

    this.getUI('loading').attr('hidden', true);
    this.getUI('error').removeAttr('hidden');
    this.$el
      .attr('aria-busy', 'false')
      .removeClass('is-exiting')
      .addClass('is-error is-visible');
  },
  onClickRetry() {
    this.getUI('retry').prop('disabled', true);
    this.$el.addClass('is-retrying');
    this.reload();
  },
  onBeforeDestroy() {
    clearTimeout(this.revealTimer);
    clearTimeout(this.dismissTimer);
    clearTimeout(this.exitTimer);
  },
});

export {
  StartupView,
};
