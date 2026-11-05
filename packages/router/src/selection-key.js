const invalidKey = () => new TypeError("Selection keys must be acyclic primitive, array or plain data values");
function snapshotKey(value, ancestors, copies) {
  if (value === null || ["undefined", "string", "number", "boolean"].includes(typeof value)) {
    return value;
  }
  if (typeof value !== "object") {
    throw invalidKey();
  }
  const path = ancestors ?? /* @__PURE__ */ new Set();
  if (path.has(value)) {
    throw invalidKey();
  }
  const memo = copies ?? /* @__PURE__ */ new WeakMap();
  const existing = memo.get(value);
  if (existing) {
    return existing;
  }
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw invalidKey();
  }
  const copy = array ? new Array(value.length) : /* @__PURE__ */ Object.create(null);
  path.add(value);
  memo.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw invalidKey();
    }
    if (array && (!Number.isInteger(Number(key)) || Number(key) < 0 || Number(key) >= value.length || String(Number(key)) !== key)) {
      throw invalidKey();
    }
    Object.defineProperty(copy, key, {
      value: snapshotKey(descriptor.value, path, memo),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  path.delete(value);
  return copy;
}
function equalKeys(a, b, pairs) {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a) && a.length !== b.length) {
    return false;
  }
  if (pairs?.get(a)?.has(b)) {
    return true;
  }
  const left = a;
  const right = b;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) {
    return false;
  }
  const memo = pairs ?? /* @__PURE__ */ new WeakMap();
  const equal = keys.every((key) => Object.hasOwn(right, key) && equalKeys(left[key], right[key], memo));
  if (equal) {
    const matches = memo.get(a) ?? /* @__PURE__ */ new WeakSet();
    matches.add(b);
    memo.set(a, matches);
  }
  return equal;
}
export {
  equalKeys,
  snapshotKey
};
