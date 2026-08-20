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
  return [...element.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter(focusable => !focusable.disabled
      && !focusable.closest('[inert]')
      && focusable.tabIndex >= 0
      && focusable.getClientRects().length);
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

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function getAdjacentFocusableElement(element, { exclude, reverse = false } = {}) {
  const focusable = getFocusableElements(document.body)
    .filter(candidate => !exclude?.contains(candidate));
  const currentIndex = focusable.indexOf(element);
  if (currentIndex < 0) return;

  return focusable[currentIndex + (reverse ? -1 : 1)];
}

export {
  FOCUSABLE_SELECTOR,
  getAdjacentFocusableElement,
  getFocusableElements,
  trapFocus,
};
