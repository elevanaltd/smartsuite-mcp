// Test utilities and mock setup for SmartSuite API Shim tests
// Context7: consulted for vitest
import { vi } from 'vitest';

import type { SmartSuiteClientConfig } from '../src/smartsuite-client.js';

// Mock implementation of createAuthenticatedClient for testing
export const mockCreateAuthenticatedClient = vi.fn(async (config: SmartSuiteClientConfig) => {
  // Return a mock client for valid test tokens
  if (config.apiKey === 'test-api-token-12345' || config.apiKey === 'env-api-token') {
    return {
      apiKey: config.apiKey,
      workspaceId: config.workspaceId,
      // Add any methods needed by tests
    };
  }
  // Throw for invalid tokens to test fail-fast behavior
  throw new Error('Invalid API credentials');
});

// Setup function to configure mocks before tests
export function setupMocks(): void {
  // Mock the smartsuite-client module
  vi.mock('../src/smartsuite-client.js', () => ({
    createAuthenticatedClient: mockCreateAuthenticatedClient,
    SmartSuiteClient: vi.fn(),
    SmartSuiteClientConfig: {},
  }));
}
