function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function isEqualArray(a, b) {
  return a.length === b.length && a.every((item, index) => isEqual(item, b[index]));
}

function isEqualObject(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && isEqual(a[key], b[key]));
}

/** Structural equality for outlet keys: primitives, arrays, and plain objects. */
export function isEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  return Array.isArray(a) ? isEqualArray(a, b) : isEqualObject(a, b);
}
