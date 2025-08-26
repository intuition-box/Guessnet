// Polyfills for server-side rendering
if (typeof window === 'undefined') {
  // Create a minimal mock for indexedDB that doesn't trigger callbacks
  // @ts-ignore
  globalThis.indexedDB = globalThis.indexedDB || {
    open: () => ({
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      readyState: 'pending'
    }),
    deleteDatabase: () => ({ onsuccess: null, onerror: null }),
    cmp: () => 0
  };
  
  // @ts-ignore  
  globalThis.crypto = globalThis.crypto || {
    randomUUID: () => 'mock-uuid',
    getRandomValues: (arr: any) => arr,
    subtle: {}
  };

  // @ts-ignore
  globalThis.localStorage = globalThis.localStorage || undefined;

  // @ts-ignore
  globalThis.sessionStorage = globalThis.sessionStorage || undefined;

  // @ts-ignore
  globalThis.window = globalThis.window || undefined;
}