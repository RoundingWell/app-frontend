import { chain } from 'underscore';

const FOCUSABLE_SELECTOR = [
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'a[href]',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(element) {
  return chain(element.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(focusable => !focusable.matches(':disabled')
      && !focusable.closest('[inert]')
      && focusable.tabIndex >= 0
      && focusable.getClientRects().length
      && window.getComputedStyle(focusable).visibility === 'visible')
    .sortBy(focusable => focusable.tabIndex || Infinity)
    .value();
}

function trapFocus(event, element) {
  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements(element);
  if (!focusable.length) {
    event.preventDefault();
    element.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export {
  FOCUSABLE_SELECTOR,
  getFocusableElements,
  trapFocus,
};
