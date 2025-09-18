import '@testing-library/jest-dom';

// Good hygiene between tests
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetModules();
});
