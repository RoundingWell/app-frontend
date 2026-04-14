import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Radio from 'backbone.radio';
import { Region } from 'marionette';

vi.mock('animejs', () => {
  return {
    animate(_target, options = {}) {
      if (options.onComplete) options.onComplete();
      return {};
    },
  };
});

import 'js/base/setup';
import AlertService from 'js/services/alert';
import { AlertView, AlertsView } from 'js/views/globals/alert-box/alert-box_views';

describe('Alert Service', () => {
  let service;
  let region;
  let regionEl;

  beforeEach(() => {
    vi.useFakeTimers();

    regionEl = document.createElement('div');
    document.body.appendChild(regionEl);

    region = new Region({ el: regionEl });
    service = new AlertService({ region });
  });

  afterEach(() => {
    service.destroy();
    region.empty();
    regionEl.remove();
    Radio.reset('alert');
    vi.useRealTimers();
  });

  it('displays and dismisses alerts', () => {
    Radio.request('alert', 'show:info', 'info');
    expect(regionEl.querySelector('.alert-box')?.textContent).toContain('info');

    Radio.request('alert', 'show:error', 'error');
    expect(regionEl.textContent).toContain('error');

    Radio.request('alert', 'show:apiError', {
      errors: [
        { detail: 'API error 1' },
        { detail: 'API error 2' },
      ],
    });
    expect(regionEl.textContent).toContain('API error 1');
    expect(regionEl.textContent).toContain('API error 2');

    Radio.request('alert', 'show:success', 'success');
    expect(regionEl.textContent).toContain('success');

    vi.advanceTimersByTime(4000);
    expect(regionEl.querySelector('.alert-box')).toBeNull();
  });

  it('reuses the existing alerts view and ignores empty api errors', () => {
    Radio.request('alert', 'show', { text: 'first', alertType: 'info' });
    const alertsView = service.getView();

    expect(alertsView.children.length).toBe(1);

    Radio.request('alert', 'show:apiError', { errors: [] });
    Radio.request('alert', 'show', { text: 'second', alertType: 'success' });

    expect(service.getView()).toBe(alertsView);
    expect(alertsView.children.length).toBe(2);
  });

  it('closes via dismiss button', () => {
    const onComplete = vi.fn();

    Radio.request('alert', 'show:undo', { onComplete });

    const dismissButton = regionEl.querySelector('.js-dismiss');
    expect(dismissButton).not.toBeNull();

    dismissButton.click();
    dismissButton.click();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(regionEl.querySelector('.alert-box')).toBeNull();
  });

  it('closes via undo button', () => {
    const onUndo = vi.fn();

    Radio.request('alert', 'show:undo', { onUndo });

    const undoButton = regionEl.querySelector('.js-undo');
    expect(undoButton).not.toBeNull();

    undoButton.click();
    undoButton.click();

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(regionEl.querySelector('.alert-box')).toBeNull();
  });

  it('ignores repeated dismiss and undo requests once dismissed', () => {
    const alertView = new AlertView({ text: 'dismiss me' });
    const dismissSpy = vi.spyOn(alertView, '_dismiss');
    const triggerSpy = vi.spyOn(alertView, 'triggerMethod');

    alertView.isDismissed = true;

    alertView.onClickUndo();
    alertView.dismiss();

    expect(dismissSpy).not.toHaveBeenCalled();
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('destroys the alerts container after the last child is removed', () => {
    const alertsView = new AlertsView();
    const destroySpy = vi.spyOn(alertsView, 'destroy');

    alertsView.children = { length: 1 };
    alertsView.onRemoveChild();

    expect(destroySpy).not.toHaveBeenCalled();

    alertsView.children = { length: 0 };
    alertsView.onRemoveChild();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
