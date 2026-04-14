import { describe, it, expect } from 'vitest';

import initPlatform from 'js/utils/platform';

describe('platform', () => {
  it('sets platform metadata on the document element', () => {
    initPlatform();

    const docEl = document.documentElement;
    expect(docEl.getAttribute('data-useragent')).toBe(navigator.userAgent);
    expect(docEl.getAttribute('data-platform')).toBe(navigator.platform);
  });
});
