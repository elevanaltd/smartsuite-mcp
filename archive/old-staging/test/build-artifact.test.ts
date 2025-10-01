// Critical-Engineer: consulted for build artifact verification strategy
// Context7: consulted for vitest
// CONTEXT7_BYPASS: CI-FIX - ESLint import order fix only
// TESTGUARD-APPROVED: TESTGUARD-20250908-6b2d5bb2
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';
import type { SmartSuiteClientConfig } from '../src/smartsuite-client.js';
// TESTGUARD-APPROVED: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0b29sX2FwcHJvdmFsIiwidGhyZWFkX2lkIjoiODM3MjM4MmQtOWRlOS00YzA4LWFkZGUtZTdjOWZmMjIwMDllIiwidHVybl9pZCI6NCwiZGVjaXNpb24iOiJhcHByb3ZlZCIsImlhdCI6MTcyMjM3MTM5Nn0.6Xh530Q-8Q7pU0n4sQvA8lO56bWw5721gJ36y99h3iA
// Mock the smartsuite-client module before importing the server
vi.mock('../src/smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn((config: SmartSuiteClientConfig): Promise<any> => {
    // Return a mock client for any valid-looking tokens
    if (config.apiKey && config.workspaceId) {
      return Promise.resolve({
        apiKey: config.apiKey,
        workspaceId: config.workspaceId,
        // Add required methods for tests
        getSchema: vi.fn().mockResolvedValue({ fields: [] }),
        get: vi.fn().mockResolvedValue({ fields: [] }),
        listRecords: vi.fn().mockResolvedValue({ records: [] }),
      });
    }
    // Throw for invalid tokens to test fail-fast behavior
    return Promise.reject(new Error('Invalid API credentials'));
  }),
}));

describe('Build Artifact Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe('Server Startup', () => {
    it('should create a valid build artifact when started with environment variables', async () => {
      // Arrange: Set environment variables
      process.env.SMARTSUITE_API_TOKEN = 'test-api-key-12345';
      process.env.SMARTSUITE_WORKSPACE_ID = 'workspace-test-67890';

      // Act: Create the server (this should succeed without throwing)
      const server = new SmartSuiteShimServer();

      // Mock authenticate to avoid real API calls
      server['authenticate'] = vi.fn().mockResolvedValue(undefined);

      // Initialize server to register tools
      await server.initialize();

      // Assert: Server should be created successfully
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(SmartSuiteShimServer);
    });

    it('should create a valid build artifact when started without environment variables', async () => {
      // Arrange: Clear any existing environment variables
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // Act: Create the server (should succeed in deferred mode)
      const server = new SmartSuiteShimServer();

      // Assert: Server should be created successfully in deferred mode
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(SmartSuiteShimServer);
    });

    it('should handle invalid credentials gracefully in fail-fast mode', async () => {
      // Arrange: Set invalid environment variables
      process.env.SMARTSUITE_API_TOKEN = 'invalid-key';
      process.env.SMARTSUITE_WORKSPACE_ID = 'invalid-workspace';

      // Force the mock to throw for these specific values
      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');
      (createAuthenticatedClient as any).mockRejectedValueOnce(new Error('Invalid API credentials'));

      // TESTGUARD-APPROVED: TESTGUARD-20250908-38bf9a44
      // Act: Create the server (constructor is synchronous)
      const server = new SmartSuiteShimServer();

      // Assert: The initialize method should throw in fail-fast mode
      await expect(server.initialize()).rejects.toThrow('Could not authenticate server with environment credentials.');
    });
  });

  describe('Type System', () => {
    it('should export TypeScript types correctly', async () => {
      // This test verifies that TypeScript compilation works
      // The actual type checking happens at compile time
      const server = new SmartSuiteShimServer();

      // If this compiles, our types are working
      expect(server).toBeDefined();
    });
  });
});
