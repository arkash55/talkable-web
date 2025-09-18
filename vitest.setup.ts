import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';

// ---------- MSW ----------
export const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  // Do not reset the module graph here; only clear mock call history
  vi.clearAllMocks();
});
afterAll(() => {
  server.close();
});

// ---------- JSDOM niceties ----------
if (!(global as any).TextEncoder) {
  const { TextEncoder, TextDecoder } = require('util');
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
}

// some libs check for crypto.getRandomValues
if (!(global as any).crypto?.getRandomValues) {
  (global as any).crypto = {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  };
}

// ensure CustomEvent exists (older jsdoms)
(() => {
  try {
    // no-op if it already works
    new CustomEvent('x');
  } catch {
    (globalThis as any).CustomEvent = class CustomEvent<T = any> extends Event {
      detail: T;
      constructor(type: string, params?: CustomEventInit<T>) {
        super(type, params);
        this.detail = params?.detail as T;
      }
    };
  }
})();

// Optional: silence ResizeObserver warnings if any component uses it
if (!(global as any).ResizeObserver) {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
