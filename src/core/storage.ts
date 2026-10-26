/** Minimal key/value storage; falls back to memory if localStorage is unavailable. */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  const ls = (() => {
    try {
      const probe = '__notenleser_probe__';
      window.localStorage.setItem(probe, probe);
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  return {
    get: (key) => {
      try {
        return ls ? ls.getItem(key) : (memory.get(key) ?? null);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set: (key, value) => {
      memory.set(key, value);
      try {
        ls?.setItem(key, value);
      } catch {
        // quota exceeded or blocked – keep the in-memory copy
      }
    },
    remove: (key) => {
      memory.delete(key);
      try {
        ls?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export function memoryStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  return {
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => void memory.set(key, value),
    remove: (key) => void memory.delete(key),
  };
}
