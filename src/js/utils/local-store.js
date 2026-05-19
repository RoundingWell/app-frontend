const localStore = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  each(callback) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    keys.forEach(key => callback(this.get(key), key));
  },
};

export default localStore;
