// cache.ts
type CacheStore<T> = {
  get: () => T | null;
  set: (value: T) => void;
  clear: () => void;
};

export const createCache = <T>(): CacheStore<T> => {
  let cache: T | null = null;

  return {
    get: () => cache,
    set: (value: T) => {
      cache = value;
    },
    clear: () => {
      cache = null;
    },
  };
};
