function toSearchParams(query) {
  if (query === void 0 || query === null) {
    return new URLSearchParams();
  }
  if (typeof query === "string" || query instanceof URLSearchParams) {
    return new URLSearchParams(query);
  }
  const entries = Object.entries(query).filter(([, value]) => value !== void 0 && value !== null).map(([key, value]) => [key, String(value)]);
  return new URLSearchParams(entries);
}
export {
  toSearchParams
};
