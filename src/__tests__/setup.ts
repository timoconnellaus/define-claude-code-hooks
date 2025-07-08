import { vi } from 'vitest';

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset modules to ensure clean state
  vi.resetModules();
});

// Mock console.error to avoid cluttering test output
global.console.error = vi.fn();

// Set up any global test utilities
export {};