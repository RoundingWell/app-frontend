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
    if (value === undefined) return this.remove(key);

    const serialized = JSON.stringify(value);

    try {
      localStorage.setItem(key, serialized);
    } catch(error) {
      if (error?.name === 'QuotaExceededError') throw error;
      if (error?.name !== 'SecurityError') throw error;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch { /* storage unavailable */ }
  },
  each(callback) {
    const keys = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
    } catch { /* storage unavailable */ }

    keys.forEach(key => callback(this.get(key), key));
  },
};

export default localStore;
