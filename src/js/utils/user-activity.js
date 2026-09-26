import { Radio } from 'marionette';

function isTextInput(target) {
  return target instanceof HTMLElement
    && (target.matches('textarea, input, select') || target.isContentEditable);
}

function hasHotkeyModifier({ altKey, ctrlKey, metaKey, shiftKey }) {
  return altKey || ctrlKey || metaKey || shiftKey;
}

export default function listenToUserActivity() {
  const controller = new AbortController();
  const { signal } = controller;

  window.addEventListener('resize', () => {
    Radio.trigger('user-activity', 'window:resize');
  }, { signal });
  document.addEventListener('keydown', evt => {
    Radio.trigger('user-activity', 'document:keydown', evt);

    if (isTextInput(evt.target) || hasHotkeyModifier(evt)) return;
    if (evt.key === '/') Radio.trigger('hotkey', 'search', evt);
    if (evt.key === 'Escape') Radio.trigger('hotkey', 'close', evt);
  }, { signal });
  document.addEventListener('mouseover', evt => {
    Radio.trigger('user-activity', 'document:mouseover', evt);
  }, { signal });
  /* istanbul ignore next: No need to test browser event delivery */
  document.addEventListener('mouseleave', evt => {
    Radio.trigger('user-activity', 'document:mouseleave', evt);
  }, { signal });
  document.body.addEventListener('pointerdown', evt => {
    Radio.trigger('user-activity', 'body:down', evt);
  }, { signal });

  return controller;
}
