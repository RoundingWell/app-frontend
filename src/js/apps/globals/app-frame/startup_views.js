import { chain, each, find } from 'underscore';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import StartupTemplate from './startup.hbs';

import './startup.scss';

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
    visual: '.js-visual',
  },
  onRender() {
    const initialVisual = document.querySelector('[data-startup-visual]');
    if (!initialVisual) return;

    // Reparenting restarts CSS animations; retain their document timeline.
    this.initialAnimations = chain(initialVisual.getAnimations({ subtree: true }))
      .filter(animation => animation.startTime != null)
      .map(animation => ({
        element: animation.effect.target,
        name: animation.animationName,
        startTime: animation.startTime,
      }))
      .value();
    this.getUI('visual')[0].replaceChildren(...initialVisual.childNodes);
  },
  onAttach() {
    each(this.initialAnimations, ({ element, name, startTime }) => {
      const animation = find(element.getAnimations(), item => item.animationName === name);
      if (animation) animation.startTime = startTime;
    });
    this.initialAnimations = null;
  },
  dismiss() {
    if (this.exitTimer) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.destroy();
      return;
    }

    this.el.setAttribute('aria-busy', 'false');
    this.el.classList.add('is-exiting');
    this.exitTimer = setTimeout(() => this.destroy(), exitDuration);
  },
  showError() {
    clearTimeout(this.exitTimer);
    this.exitTimer = null;

    this.getUI('loading')[0].hidden = true;
    this.getUI('error')[0].hidden = false;
    this.el.setAttribute('aria-busy', 'false');
    this.el.classList.remove('is-exiting');
    this.el.classList.add('is-error');
  },
  onClickRetry() {
    this.getUI('retry')[0].disabled = true;
    this.el.classList.add('is-retrying');
    window.location.reload();
  },
  onBeforeDestroy() {
    clearTimeout(this.exitTimer);
    this.initialAnimations = null;
  },
});

export {
  StartupView,
};
