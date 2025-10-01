// Tests for SmartSuite MCP Server authentication and initialization
// Context7: consulted for vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';

// Mock the createAuthenticatedClient to avoid real API calls in tests
vi.mock('../src/smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn(async (config) => {
    // Return a mock client for valid test tokens
    if (config.apiKey === 'test-api-token-12345' || config.apiKey === 'env-api-token') {
      return {
        apiKey: config.apiKey,
        workspaceId: config.workspaceId,
        // Add required methods for tests
        getSchema: vi.fn().mockResolvedValue({
          id: 'test-app-id',
          name: 'Test Application',
          structure: [],
        }),
        get: vi.fn().mockResolvedValue({ fields: [] }),
      };
    }
    // Throw for invalid tokens to test fail-fast behavior
    throw new Error('Invalid API credentials');
  }),
  SmartSuiteClient: vi.fn(),
  SmartSuiteClientConfig: {},
}));

describe('SmartSuiteShimServer - Authentication & Initialization', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear any existing auth env vars
    delete process.env.SMARTSUITE_API_TOKEN;
    delete process.env.SMARTSUITE_WORKSPACE_ID;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('fail-fast initialization pattern', () => {
    it('should successfully initialize when environment variables are valid', async () => {
      // ARRANGE: Set up valid environment variables
      process.env.SMARTSUITE_API_TOKEN = 'test-api-token-12345';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';

      // ACT: Create server and initialize
      const server = new SmartSuiteShimServer();
      await expect(server.initialize()).resolves.not.toThrow();

      // ASSERT: Server should be authenticated after successful initialization
      expect(server.isAuthenticated()).toBe(true);
    });

    it('should follow fail-fast pattern and throw when auto-authentication fails', async () => {
      // ARRANGE: Set up invalid environment variables
      process.env.SMARTSUITE_API_TOKEN = 'invalid-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'invalid-workspace';

      // ACT: Create server and try to initialize
      const server = new SmartSuiteShimServer();

      // ASSERT: Initialize should throw when authentication fails
      await expect(server.initialize()).rejects.toThrow(
        'Could not authenticate server with environment credentials.',
      );

      // ASSERT: Server should not be authenticated after failed initialization
      expect(server.isAuthenticated()).toBe(false);
    });

    it('should not throw when no environment variables are present (interactive mode)', async () => {
      // ARRANGE: Clear environment variables
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // ACT: Create server and initialize
      const server = new SmartSuiteShimServer();
      await expect(server.initialize()).resolves.not.toThrow();

      // ASSERT: Server should not be authenticated (requires manual auth)
      expect(server.isAuthenticated()).toBe(false);
    });

    it('should block tool execution when not authenticated', async () => {
      // ARRANGE: Clear environment variables
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // ACT: Create server and initialize (no auto-auth)
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ASSERT: Tool execution should require authentication
      await expect(
        server.executeTool('smartsuite_schema', {
          appId: '6613bedd1889d8deeaef8b0e',
        }),
      ).rejects.toThrow('Authentication required: call authenticate() first');
    });

    it('should allow tool execution after successful initialization with env vars', async () => {
      // ARRANGE: Set up valid environment variables
      process.env.SMARTSUITE_API_TOKEN = 'test-api-token-12345';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';

      // ACT: Create server and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ASSERT: Tool execution should work without throwing authentication error
      await expect(
        server.executeTool('smartsuite_schema', {
          appId: '6613bedd1889d8deeaef8b0e',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('configuration management', () => {
    it('should store auth config from environment variables', async () => {
      // ARRANGE: Set up environment variables
      process.env.SMARTSUITE_API_TOKEN = 'env-api-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'env-workspace-id';

      // ACT: Create server and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ASSERT: Auth config should match environment variables (with baseUrl added)
      const config = server.getAuthConfig();
      expect(config?.apiKey).toBe('env-api-token');
      expect(config?.workspaceId).toBe('env-workspace-id');
    });

    it('should not have auth config when env vars are missing', async () => {
      // ARRANGE: Clear environment variables
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // ACT: Create server and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ASSERT: No auth config should be set
      expect(server.getAuthConfig()).toBeUndefined();
    });
  });
});
