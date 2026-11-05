function navigationDriver(navigation = globalThis.navigation) {
  if (!navigation) {
    throw new TypeError("navigationDriver requires the Navigation API");
  }
  const source = navigation;
  return {
    capabilities: { cancelTraverse: false, interceptsLinks: true },
    get activation() {
      return source.activation;
    },
    get currentEntry() {
      return source.currentEntry;
    },
    entries: () => source.entries(),
    navigate: (url, options) => source.navigate(url, options),
    reload: (options) => source.reload(options),
    back: () => source.back(),
    traverseTo: (key) => source.traverseTo(key),
    updateCurrentEntry: (options) => source.updateCurrentEntry(options),
    addEventListener: (type, listener, options) => source.addEventListener(type, listener, options)
  };
}
export {
  navigationDriver
};
