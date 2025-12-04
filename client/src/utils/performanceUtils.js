export const memoizeOne = (fn) => {
  let lastArgs = null;
  let lastResult = null;

  return (...args) => {
    if (
      lastArgs &&
      args.length === lastArgs.length &&
      args.every((arg, index) => arg === lastArgs[index])
    ) {
      return lastResult;
    }

    lastArgs = args;
    lastResult = fn(...args);
    return lastResult;
  };
};

export const createLRUCache = (maxSize = 100) => {
  const cache = new Map();

  return {
    get(key) {
      if (!cache.has(key)) return undefined;
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    },

    set(key, value) {
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(key, value);
    },

    has(key) {
      return cache.has(key);
    },

    clear() {
      cache.clear();
    },

    get size() {
      return cache.size;
    },
  };
};

export const batchUpdates = (() => {
  let pending = [];
  let scheduled = false;

  const flush = () => {
    const updates = pending;
    pending = [];
    scheduled = false;
    updates.forEach((update) => update());
  };

  return (update) => {
    pending.push(update);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  };
})();

export const measurePerformance = (name, fn) => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
  return result;
};

export const measureAsyncPerformance = async (name, fn) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
  return result;
};

export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

export const preloadVideo = (src) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => resolve(video);
    video.onerror = reject;
    video.src = src;
    video.preload = 'metadata';
  });
};

export const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const requestIdleCallback =
  window.requestIdleCallback ||
  ((cb) => {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1);
  });

export const cancelIdleCallback =
  window.cancelIdleCallback || ((id) => clearTimeout(id));
