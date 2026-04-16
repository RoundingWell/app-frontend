import { afterEach } from 'vitest';

if (!RegExp.escape) {
  RegExp.escape = function(str) {
    return str.replace(/[\\^$.*+?()[\]{}|-]/g, '\\$&');
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-useragent');
  document.documentElement.removeAttribute('data-platform');
});
